import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';

export interface BackupResult {
  success: boolean;
  backupId: string;
  timestamp: string;
  size?: number;
  error?: string;
  collections: string[];
}

export interface RestoreResult {
  success: boolean;
  backupId: string;
  timestamp: string;
  error?: string;
  restoredCollections: string[];
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.storage = new Storage({
      projectId: this.configService.get('FIREBASE_PROJECT_ID'),
    });
    this.bucketName = `${this.configService.get('FIREBASE_PROJECT_ID')}-backups`;
  }

  async createBackup(): Promise<BackupResult> {
    const backupId = `backup-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    try {
      this.logger.log(`Starting backup: ${backupId}`);
      
      const collections = [
        'users',
        'payments',
        'payment_transaction_logs',
        'reservations',
        'common_areas',
        'meetings',
        'notifications',
        'audit_logs',
      ];

      const backupData: Record<string, any[]> = {};
      let totalSize = 0;

      // Backup each collection
      for (const collectionName of collections) {
        this.logger.log(`Backing up collection: ${collectionName}`);
        
        const collectionData = await this.backupCollection(collectionName);
        backupData[collectionName] = collectionData;
        totalSize += JSON.stringify(collectionData).length;
      }

      // Upload backup to Cloud Storage
      const backupFileName = `${backupId}.json`;
      const file = this.storage.bucket(this.bucketName).file(backupFileName);
      
      await file.save(JSON.stringify(backupData, null, 2), {
        metadata: {
          contentType: 'application/json',
          metadata: {
            backupId,
            timestamp,
            collections: collections.join(','),
            environment: this.configService.get('NODE_ENV'),
          },
        },
      });

      // Create backup metadata document
      await admin.firestore()
        .collection('backup_metadata')
        .doc(backupId)
        .set({
          backupId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          collections,
          size: totalSize,
          status: 'completed',
          fileName: backupFileName,
          environment: this.configService.get('NODE_ENV'),
        });

      this.logger.log(`Backup completed: ${backupId}, Size: ${totalSize} bytes`);

      return {
        success: true,
        backupId,
        timestamp,
        size: totalSize,
        collections,
      };
    } catch (error) {
      this.logger.error(`Backup failed: ${backupId}`, error);
      
      // Record failed backup
      try {
        await admin.firestore()
          .collection('backup_metadata')
          .doc(backupId)
          .set({
            backupId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: error.message,
            environment: this.configService.get('NODE_ENV'),
          });
      } catch (metadataError) {
        this.logger.error('Failed to record backup failure', metadataError);
      }

      return {
        success: false,
        backupId,
        timestamp,
        error: error.message,
        collections: [],
      };
    }
  }

  async restoreBackup(backupId: string): Promise<RestoreResult> {
    const timestamp = new Date().toISOString();
    
    try {
      this.logger.log(`Starting restore: ${backupId}`);
      
      // Get backup metadata
      const metadataDoc = await admin.firestore()
        .collection('backup_metadata')
        .doc(backupId)
        .get();

      if (!metadataDoc.exists) {
        throw new Error(`Backup metadata not found: ${backupId}`);
      }

      const metadata = metadataDoc.data();
      const fileName = metadata.fileName;

      // Download backup file
      const file = this.storage.bucket(this.bucketName).file(fileName);
      const [fileContents] = await file.download();
      const backupData = JSON.parse(fileContents.toString());

      const restoredCollections: string[] = [];

      // Restore each collection
      for (const [collectionName, documents] of Object.entries(backupData)) {
        this.logger.log(`Restoring collection: ${collectionName}`);
        
        await this.restoreCollection(collectionName, documents as any[]);
        restoredCollections.push(collectionName);
      }

      // Record successful restore
      await admin.firestore()
        .collection('restore_metadata')
        .add({
          backupId,
          restoreTimestamp: admin.firestore.FieldValue.serverTimestamp(),
          restoredCollections,
          status: 'completed',
          environment: this.configService.get('NODE_ENV'),
        });

      this.logger.log(`Restore completed: ${backupId}`);

      return {
        success: true,
        backupId,
        timestamp,
        restoredCollections,
      };
    } catch (error) {
      this.logger.error(`Restore failed: ${backupId}`, error);
      
      // Record failed restore
      try {
        await admin.firestore()
          .collection('restore_metadata')
          .add({
            backupId,
            restoreTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: error.message,
            environment: this.configService.get('NODE_ENV'),
          });
      } catch (metadataError) {
        this.logger.error('Failed to record restore failure', metadataError);
      }

      return {
        success: false,
        backupId,
        timestamp,
        error: error.message,
        restoredCollections: [],
      };
    }
  }

  async listBackups(): Promise<{
    backupId: string;
    timestamp: any;
    collections: string[];
    size: number;
    status: string;
  }[]> {
    try {
      const snapshot = await admin.firestore()
        .collection('backup_metadata')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      return snapshot.docs.map(doc => doc.data() as any);
    } catch (error) {
      this.logger.error('Failed to list backups', error);
      return [];
    }
  }

  async deleteOldBackups(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const snapshot = await admin.firestore()
        .collection('backup_metadata')
        .where('timestamp', '<', cutoffDate)
        .get();

      const batch = admin.firestore().batch();
      const filesToDelete: string[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.fileName) {
          filesToDelete.push(data.fileName);
        }
        batch.delete(doc.ref);
      });

      // Delete metadata documents
      await batch.commit();

      // Delete backup files from storage
      for (const fileName of filesToDelete) {
        try {
          await this.storage.bucket(this.bucketName).file(fileName).delete();
          this.logger.log(`Deleted old backup file: ${fileName}`);
        } catch (error) {
          this.logger.warn(`Failed to delete backup file: ${fileName}`, error);
        }
      }

      this.logger.log(`Deleted ${snapshot.docs.length} old backups`);
    } catch (error) {
      this.logger.error('Failed to delete old backups', error);
    }
  }

  private async backupCollection(collectionName: string): Promise<any[]> {
    const snapshot = await admin.firestore()
      .collection(collectionName)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
  }

  private async restoreCollection(collectionName: string, documents: any[]): Promise<void> {
    const batch = admin.firestore().batch();
    const collection = admin.firestore().collection(collectionName);

    documents.forEach(({ id, data }) => {
      const docRef = collection.doc(id);
      batch.set(docRef, data);
    });

    await batch.commit();
  }

  async createScheduledBackup(): Promise<BackupResult> {
    this.logger.log('Starting scheduled backup');
    
    const result = await this.createBackup();
    
    if (result.success) {
      // Clean up old backups
      await this.deleteOldBackups(30);
    }
    
    return result;
  }

  async validateBackupIntegrity(backupId: string): Promise<{
    valid: boolean;
    errors: string[];
    collections: Record<string, { documentCount: number; valid: boolean }>;
  }> {
    try {
      const metadataDoc = await admin.firestore()
        .collection('backup_metadata')
        .doc(backupId)
        .get();

      if (!metadataDoc.exists) {
        return {
          valid: false,
          errors: ['Backup metadata not found'],
          collections: {},
        };
      }

      const metadata = metadataDoc.data();
      const fileName = metadata.fileName;

      // Download and parse backup file
      const file = this.storage.bucket(this.bucketName).file(fileName);
      const [fileContents] = await file.download();
      const backupData = JSON.parse(fileContents.toString());

      const errors: string[] = [];
      const collections: Record<string, { documentCount: number; valid: boolean }> = {};

      // Validate each collection
      for (const [collectionName, documents] of Object.entries(backupData)) {
        const documentArray = documents as any[];
        let valid = true;

        // Basic validation
        if (!Array.isArray(documentArray)) {
          errors.push(`Collection ${collectionName} is not an array`);
          valid = false;
        } else {
          // Validate document structure
          for (const doc of documentArray) {
            if (!doc.id || !doc.data) {
              errors.push(`Invalid document structure in collection ${collectionName}`);
              valid = false;
              break;
            }
          }
        }

        collections[collectionName] = {
          documentCount: Array.isArray(documentArray) ? documentArray.length : 0,
          valid,
        };
      }

      return {
        valid: errors.length === 0,
        errors,
        collections,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        collections: {},
      };
    }
  }
}