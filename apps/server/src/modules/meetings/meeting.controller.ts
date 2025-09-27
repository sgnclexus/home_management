import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { VoteService } from './vote.service';
import { AgreementService } from './agreement.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { 
  Meeting, 
  Vote, 
  Agreement,
  AgreementComment,
  CreateMeetingDto, 
  UpdateMeetingDto, 
  MeetingQueryDto,
  CreateVoteDto,
  CastVoteDto,
  CreateAgreementDto,
  UpdateAgreementDto,
  CreateAgreementCommentDto,
  UserRole,
  User
} from '@home-management/types';

@Controller('meetings')
@UseGuards(FirebaseAuthGuard)
export class MeetingController {
  constructor(
    private readonly meetingService: MeetingService,
    private readonly voteService: VoteService,
    private readonly agreementService: AgreementService,
  ) {}

  // Meeting endpoints
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async createMeeting(
    @Body() createMeetingDto: CreateMeetingDto,
    @CurrentUser() user: User,
  ): Promise<Meeting> {
    return this.meetingService.createMeeting(createMeetingDto, user.uid);
  }

  @Get()
  async getMeetings(@Query() queryDto: MeetingQueryDto): Promise<Meeting[]> {
    return this.meetingService.getMeetings(queryDto);
  }

  @Get('upcoming')
  async getUpcomingMeetings(@CurrentUser() user: User): Promise<Meeting[]> {
    return this.meetingService.getUpcomingMeetings(user.uid);
  }

  @Get('my-meetings')
  async getUserMeetings(@CurrentUser() user: User): Promise<Meeting[]> {
    return this.meetingService.getUserMeetings(user.uid);
  }

  @Get(':id')
  async getMeetingById(@Param('id') id: string): Promise<Meeting> {
    return this.meetingService.getMeetingById(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async updateMeeting(
    @Param('id') id: string,
    @Body() updateMeetingDto: UpdateMeetingDto,
    @CurrentUser() user: User,
  ): Promise<Meeting> {
    return this.meetingService.updateMeeting(id, updateMeetingDto, user.uid, user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMeeting(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.meetingService.deleteMeeting(id, user.uid, user.role);
  }

  @Put(':id/notes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async publishNotes(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @CurrentUser() user: User,
  ): Promise<Meeting> {
    return this.meetingService.publishNotes(id, notes, user.uid, user.role);
  }

  @Put(':id/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async startMeeting(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Meeting> {
    return this.meetingService.startMeeting(id, user.uid, user.role);
  }

  @Put(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async completeMeeting(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Meeting> {
    return this.meetingService.completeMeeting(id, user.uid, user.role);
  }

  @Put(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async cancelMeeting(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Meeting> {
    return this.meetingService.cancelMeeting(id, user.uid, user.role);
  }

  // Vote endpoints
  @Post(':meetingId/votes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async createVote(
    @Param('meetingId') meetingId: string,
    @Body() createVoteDto: CreateVoteDto,
    @CurrentUser() user: User,
  ): Promise<Vote> {
    const voteDto = { ...createVoteDto, meetingId };
    return this.voteService.createVote(voteDto, user.uid);
  }

  @Get(':meetingId/votes')
  async getMeetingVotes(@Param('meetingId') meetingId: string): Promise<Vote[]> {
    return this.voteService.getVotesByMeeting(meetingId);
  }

  @Post('votes/:voteId/cast')
  async castVote(
    @Param('voteId') voteId: string,
    @Body() castVoteDto: Omit<CastVoteDto, 'voteId'>,
    @CurrentUser() user: User,
  ): Promise<Vote> {
    const fullCastVoteDto = { ...castVoteDto, voteId };
    return this.voteService.castVote(fullCastVoteDto, user.uid);
  }

  @Put('votes/:voteId/close')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async closeVote(
    @Param('voteId') voteId: string,
    @CurrentUser() user: User,
  ): Promise<Vote> {
    return this.voteService.closeVote(voteId, user.uid, user.role);
  }

  @Put('votes/:voteId/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async cancelVote(
    @Param('voteId') voteId: string,
    @CurrentUser() user: User,
  ): Promise<Vote> {
    return this.voteService.cancelVote(voteId, user.uid, user.role);
  }

  @Get('votes/:voteId')
  async getVoteById(@Param('voteId') voteId: string): Promise<Vote> {
    return this.voteService.getVoteById(voteId);
  }

  @Get('votes/:voteId/status')
  async getUserVoteStatus(
    @Param('voteId') voteId: string,
    @CurrentUser() user: User,
  ): Promise<{ hasVoted: boolean; selectedOptions?: string[] }> {
    return this.voteService.getUserVoteStatus(voteId, user.uid);
  }

  @Get('votes/:voteId/results')
  async getVoteResults(
    @Param('voteId') voteId: string,
    @CurrentUser() user: User,
  ): Promise<{ vote: Vote; totalVotes: number; participationRate: number }> {
    return this.voteService.getVoteResults(voteId, user.uid);
  }

  // Agreement endpoints
  @Post('agreements')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async createAgreement(
    @Body() createAgreementDto: CreateAgreementDto,
    @CurrentUser() user: User,
  ): Promise<Agreement> {
    return this.agreementService.createAgreement(createAgreementDto, user.uid);
  }

  @Get('agreements')
  async getAgreements(@Query() queryDto: any): Promise<Agreement[]> {
    return this.agreementService.getAgreements(queryDto);
  }

  @Get('agreements/active')
  async getActiveAgreements(): Promise<Agreement[]> {
    return this.agreementService.getActiveAgreements();
  }

  @Get('agreements/:id')
  async getAgreementById(@Param('id') id: string): Promise<Agreement> {
    return this.agreementService.getAgreementById(id);
  }

  @Put('agreements/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async updateAgreement(
    @Param('id') id: string,
    @Body() updateAgreementDto: UpdateAgreementDto,
    @CurrentUser() user: User,
  ): Promise<Agreement> {
    return this.agreementService.updateAgreement(id, updateAgreementDto, user.uid, user.role);
  }

  @Delete('agreements/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAgreement(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.agreementService.deleteAgreement(id, user.uid, user.role);
  }

  @Put('agreements/:id/approve')
  async approveAgreement(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Agreement> {
    return this.agreementService.approveAgreement(id, user.uid);
  }

  @Put('agreements/:id/reject')
  async rejectAgreement(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Agreement> {
    return this.agreementService.rejectAgreement(id, user.uid);
  }

  @Put('agreements/:id/activate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async activateAgreement(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Agreement> {
    return this.agreementService.activateAgreement(id, user.uid, user.role);
  }

  @Put('agreements/:id/expire')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async expireAgreement(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Agreement> {
    return this.agreementService.expireAgreement(id, user.uid, user.role);
  }

  @Put('agreements/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async cancelAgreement(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Agreement> {
    return this.agreementService.cancelAgreement(id, user.uid, user.role);
  }

  // Agreement comment endpoints
  @Post('agreements/:agreementId/comments')
  async addAgreementComment(
    @Param('agreementId') agreementId: string,
    @Body() createCommentDto: Omit<CreateAgreementCommentDto, 'agreementId'>,
    @CurrentUser() user: User,
  ): Promise<AgreementComment> {
    const fullCommentDto = { ...createCommentDto, agreementId };
    return this.agreementService.addComment(fullCommentDto, user.uid);
  }

  @Get('agreements/:agreementId/comments')
  async getAgreementComments(@Param('agreementId') agreementId: string): Promise<AgreementComment[]> {
    return this.agreementService.getAgreementComments(agreementId);
  }

  @Delete('agreements/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAgreementComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.agreementService.deleteComment(commentId, user.uid, user.role);
  }
}