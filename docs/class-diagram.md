# Messers Cardio Club - vollstaendiges Klassendiagramm

Diese Datei gibt einen Gesamtueberblick ueber die App: Screens, UI-Komponenten, Contexts, Services, Business-Logik und Supabase/PostgreSQL-Datenmodell.

## Grafik

![Messers Cardio Club Klassendiagramm](./class-diagram-graphic.svg)

## Entwickler-Grafik

![Messers Cardio Club Entwickler-Architektur](./developer-architecture-graph.svg)

## 1. App-Architektur

```mermaid
classDiagram
direction LR

class ExpoRouterApp {
  +StackNavigation
  +WebHtmlConfig
  +RouteProtection
}

class AuthScreen {
  +loginWithPhoneAndPin()
  +registerWithInviteCode()
  +verifySmsCode()
  +resetForgottenPin()
  +normalizePhone()
}

class HomeEventScreen {
  +loadCurrentEvent()
  +chooseAttendance()
  +voteForSports()
  +showOverview()
  +showHiddenDecisionUntilFinalized()
}

class ChatScreen {
  +loadMessages()
  +sendMessage()
  +subscribeToEventChat()
}

class MembersScreen {
  +listMembers()
  +sortByJoinedAt()
  +openMemberProfile()
}

class MenuScreen {
  +navigateToProfile()
  +navigateToInvites()
  +navigateToSportIdeas()
  +navigateToAdmin()
  +showAdminNotifications()
  +markNotificationRead()
  +markNotificationUnread()
}

class ProfileScreen {
  +editFavoriteSports()
  +editBirthday()
  +requestNameChange()
  +changePhoneWithSms()
}

class PinScreen {
  +changeCurrentPin()
}

class InvitesScreen {
  +createInviteCode()
  +listInviteCodes()
  +shareInviteCode()
}

class IdeasScreen {
  +submitSportIdea()
  +listOwnAndPendingIdeas()
  +adminReviewIdea()
}

class AdminScreen {
  +manageMembers()
  +manageSports()
  +manageSportContacts()
  +reviewNameRequests()
  +deactivateMembers()
}

class PushScreen {
  +requestPermission()
  +savePushToken()
}

class ClubScreens {
  +legacyClubList()
  +legacyClubCreate()
  +legacyClubDashboard()
  +legacyEventHistory()
}

class EventDetailScreens {
  +legacyAttendance()
  +legacyVote()
  +legacyPropose()
  +legacyDecision()
}

class AuthContext {
  +user
  +session
  +loading
  +signOut()
}

class ThemeContext {
  +mode
  +theme
  +toggleTheme()
}

class SupabaseClient {
  +auth
  +database
  +storage
  +persistSession()
}

class SharedUI {
  +AuthIntro
  +BrandBackground
  +BottomNav
  +PageHeader
  +BackButton
  +ThemeToggle
  +Motion
  +Button
  +LoadingState
  +ErrorText
}

ExpoRouterApp --> AuthScreen
ExpoRouterApp --> HomeEventScreen
ExpoRouterApp --> ChatScreen
ExpoRouterApp --> MembersScreen
ExpoRouterApp --> MenuScreen
ExpoRouterApp --> ProfileScreen
ExpoRouterApp --> PinScreen
ExpoRouterApp --> InvitesScreen
ExpoRouterApp --> IdeasScreen
ExpoRouterApp --> AdminScreen
ExpoRouterApp --> PushScreen
ExpoRouterApp --> ClubScreens
ExpoRouterApp --> EventDetailScreens

AuthScreen --> AuthContext
HomeEventScreen --> AuthContext
ChatScreen --> AuthContext
MembersScreen --> AuthContext
MenuScreen --> AuthContext
ProfileScreen --> AuthContext
AdminScreen --> AuthContext

AuthScreen --> ThemeContext
HomeEventScreen --> ThemeContext
MenuScreen --> ThemeContext
AdminScreen --> ThemeContext

AuthContext --> SupabaseClient
AuthScreen --> SupabaseClient
ProfileScreen --> SupabaseClient

AuthScreen --> SharedUI
HomeEventScreen --> SharedUI
ChatScreen --> SharedUI
MembersScreen --> SharedUI
MenuScreen --> SharedUI
ProfileScreen --> SharedUI
AdminScreen --> SharedUI
InvitesScreen --> SharedUI
IdeasScreen --> SharedUI
PushScreen --> SharedUI
```

## 2. Service- und Business-Logik

```mermaid
classDiagram
direction LR

class AppSupabaseClient {
  +from()
  +rpc()
  +auth()
}

class ResultService {
  +ok()
  +fail()
  +fromPostgrestError()
}

class ClubsService {
  +createClub()
  +joinClub()
  +listClubs()
}

class LiveAppService {
  +ensureMccWeek()
  +getLiveAppState()
}

class EventsService {
  +createWeeklyEvent()
  +getCurrentWeeklyEvent()
  +getEventHistory()
}

class AttendanceService {
  +updateAttendance()
  +listAttendance()
}

class ProposalsService {
  +proposeSport()
  +listSportProposals()
}

class VotesService {
  +voteForSport()
  +removeVote()
  +listVotes()
}

class DecisionsService {
  +getEventDecisionPreview()
  +finalizeEventDecision()
  +createSubgroupsFromDecision()
  +resolveSportContact()
}

class InvitationsService {
  +validateInvitationCode()
  +consumeInvitationCode()
  +createInvitationCode()
  +listInvitationCodes()
}

class ProfilesService {
  +ensureProfile()
  +normalizePhone()
  +updateProfileDetails()
  +requestDisplayNameChange()
}

class MembersService {
  +listMccMembers()
  +mapPublicMemberProfile()
}

class ChatService {
  +listChatMessages()
  +sendChatMessage()
}

class SportIdeasService {
  +suggestSportIdea()
  +listSportIdeas()
  +reviewSportIdea()
}

class AdminPanelService {
  +updateMccMemberRole()
  +deactivateMccMember()
  +listMccSports()
  +upsertMccSport()
  +deleteMccSport()
  +listMccSportContacts()
  +upsertMccSportContact()
  +deleteMccSportContact()
}

class PushService {
  +registerPushToken()
}

class DateService {
  +formatDate()
  +weekStartDate()
}

class VotingRules {
  +maxVotesPerUser()
  +rankToWeight()
  +validateVotingOpen()
}

class VotingEligibility {
  +mustAttendToVote()
  +excludeNonParticipants()
}

class SportCompatibility {
  +canCombineSports()
  +scoreCompatibility()
}

class FairSportSelection {
  +selectFairSport()
  +scoreSports()
  +applyPreviousWeekExclusion()
  +applyFairnessBoost()
  +recommendCombinedOrSubgroups()
}

class DecisionPresentation {
  +buildHumanExplanation()
  +classifyDecisionMode()
  +hideMathByDefault()
}

ClubsService --> AppSupabaseClient
LiveAppService --> AppSupabaseClient
EventsService --> AppSupabaseClient
AttendanceService --> AppSupabaseClient
ProposalsService --> AppSupabaseClient
VotesService --> AppSupabaseClient
DecisionsService --> AppSupabaseClient
InvitationsService --> AppSupabaseClient
ProfilesService --> AppSupabaseClient
MembersService --> AppSupabaseClient
ChatService --> AppSupabaseClient
SportIdeasService --> AppSupabaseClient
AdminPanelService --> AppSupabaseClient
PushService --> AppSupabaseClient

ClubsService --> ResultService
EventsService --> ResultService
AttendanceService --> ResultService
ProposalsService --> ResultService
VotesService --> ResultService
DecisionsService --> ResultService
InvitationsService --> ResultService
ProfilesService --> ResultService
MembersService --> ResultService
ChatService --> ResultService
SportIdeasService --> ResultService
AdminPanelService --> ResultService
PushService --> ResultService

DecisionsService --> FairSportSelection
DecisionsService --> DecisionPresentation
FairSportSelection --> VotingRules
FairSportSelection --> VotingEligibility
FairSportSelection --> SportCompatibility
FairSportSelection --> DecisionPresentation
EventsService --> DateService
```

## 3. Supabase/PostgreSQL-Datenmodell

```mermaid
classDiagram
direction LR

class Profile {
  +uuid id
  +string display_name
  +string avatar_url
  +string email
  +string phone
  +app_role role
  +string city
  +string postal_code
  +string[] favorite_sports
  +date birth_date
  +timestamp deactivated_at
  +string deactivated_reason
  +timestamp created_at
}

class Club {
  +uuid id
  +string name
  +string description
  +uuid created_by
  +timestamp created_at
}

class ClubMember {
  +uuid id
  +uuid club_id
  +uuid user_id
  +role member|mod|admin
  +timestamp joined_at
}

class Sport {
  +uuid id
  +string name
  +string description
  +string location_description
  +string category
  +intensity low|medium|high
  +location_type indoor|outdoor|water|field|flexible
  +string[] combinable_tags
  +uuid created_by
  +timestamp created_at
}

class WeeklyEvent {
  +uuid id
  +uuid club_id
  +date week_start_date
  +uuid selected_sport_id
  +uuid secondary_sport_id
  +status proposing|voting|decided|completed|cancelled
  +string location
  +timestamp starts_at
  +string notes
  +string decision_reason
  +uuid activity_contact_id
  +timestamp created_at
}

class SportProposal {
  +uuid id
  +uuid event_id
  +uuid sport_id
  +uuid proposed_by
  +string note
  +timestamp created_at
}

class SportVote {
  +uuid id
  +uuid event_id
  +uuid sport_id
  +uuid user_id
  +number weight
  +timestamp created_at
}

class Attendance {
  +uuid id
  +uuid event_id
  +uuid user_id
  +status going|maybe|not_going
  +uuid subgroup_id
  +timestamp created_at
}

class MemberPreferenceHistory {
  +uuid id
  +uuid club_id
  +uuid user_id
  +uuid sport_id
  +date week_start_date
  +boolean was_selected
  +boolean voted_for
  +timestamp created_at
}

class EventSubgroup {
  +uuid id
  +uuid event_id
  +uuid sport_id
  +string title
  +string location
  +timestamp starts_at
  +uuid activity_contact_id
  +timestamp created_at
}

class ChatMessage {
  +uuid id
  +uuid club_id
  +uuid event_id
  +uuid subgroup_id
  +uuid user_id
  +string body
  +timestamp created_at
}

class InvitationCode {
  +uuid id
  +string code
  +uuid created_by
  +uuid used_by
  +timestamp used_at
  +timestamp created_at
}

class SportIdea {
  +uuid id
  +string name
  +string note
  +string location
  +string preferred_time
  +uuid suggested_by
  +status pending|approved|rejected
  +timestamp created_at
}

class PushSubscription {
  +uuid id
  +uuid user_id
  +string token
  +string platform
  +timestamp created_at
}

class ProfileChangeRequest {
  +uuid id
  +uuid user_id
  +string requested_display_name
  +status pending|approved|rejected
  +uuid reviewed_by
  +timestamp reviewed_at
  +timestamp created_at
}

class SportContact {
  +uuid id
  +uuid sport_id
  +uuid user_id
  +string note
  +boolean is_primary
  +uuid created_by
  +timestamp created_at
}

Profile "1" --> "*" Club : created_by
Club "1" --> "*" ClubMember
Profile "1" --> "*" ClubMember

Club "1" --> "*" WeeklyEvent
Sport "1" --> "*" WeeklyEvent : selected_sport_id
Sport "1" --> "*" WeeklyEvent : secondary_sport_id
Profile "1" --> "*" WeeklyEvent : activity_contact_id

WeeklyEvent "1" --> "*" SportProposal
Sport "1" --> "*" SportProposal
Profile "1" --> "*" SportProposal : proposed_by

WeeklyEvent "1" --> "*" SportVote
Sport "1" --> "*" SportVote
Profile "1" --> "*" SportVote

WeeklyEvent "1" --> "*" Attendance
Profile "1" --> "*" Attendance
EventSubgroup "1" --> "*" Attendance

Club "1" --> "*" MemberPreferenceHistory
Profile "1" --> "*" MemberPreferenceHistory
Sport "1" --> "*" MemberPreferenceHistory

WeeklyEvent "1" --> "*" EventSubgroup
Sport "1" --> "*" EventSubgroup
Profile "1" --> "*" EventSubgroup : activity_contact_id

Club "1" --> "*" ChatMessage
WeeklyEvent "1" --> "*" ChatMessage
EventSubgroup "1" --> "*" ChatMessage
Profile "1" --> "*" ChatMessage

Profile "1" --> "*" InvitationCode : created_by
Profile "1" --> "*" InvitationCode : used_by

Profile "1" --> "*" SportIdea : suggested_by
Profile "1" --> "*" PushSubscription
Profile "1" --> "*" ProfileChangeRequest
Profile "1" --> "*" ProfileChangeRequest : reviewed_by

Sport "1" --> "*" SportContact
Profile "1" --> "*" SportContact
Profile "1" --> "*" SportContact : created_by
```

## 4. Wichtige App-Flows

```mermaid
classDiagram
direction TB

class InviteRegistrationFlow {
  +enterInviteCode()
  +validateCode()
  +createPhoneAuthUser()
  +verifySms()
  +consumeInvite()
  +ensureProfile()
  +enterApp()
}

class LoginFlow {
  +enterPhoneAndPin()
  +normalizePhone()
  +signInWithPassword()
  +checkDeactivation()
  +enterApp()
}

class ForgotPinFlow {
  +enterPhone()
  +sendOtpWithoutUserLeak()
  +verifySms()
  +rejectSamePin()
  +setNewPin()
}

class WeeklyEventFlow {
  +showAttendanceFirst()
  +ifGoingOrMaybeAllowVote()
  +rankUpToThreeSports()
  +hideFinalSportUntilDecision()
  +showEventOverview()
}

class AdminFlow {
  +reviewSportIdeas()
  +reviewNameChanges()
  +manageSports()
  +manageSportContacts()
  +manageRoles()
  +deactivateUsers()
}

class DecisionFlow {
  +collectEligibleVotes()
  +excludePreviousWeekSport()
  +applyFairnessBoost()
  +applyDiversityScore()
  +detectCombinedEvent()
  +detectSubgroups()
  +persistDecision()
  +openChatAfterDecision()
}

InviteRegistrationFlow --> LoginFlow
LoginFlow --> WeeklyEventFlow
ForgotPinFlow --> LoginFlow
WeeklyEventFlow --> DecisionFlow
AdminFlow --> DecisionFlow
AdminFlow --> WeeklyEventFlow
```

## 5. Testabdeckung

```mermaid
classDiagram
direction LR

class FairSportSelectionTests {
  +majorityWins()
  +previousWeekExcluded()
  +neglectedMinorityCanWin()
  +fairnessBoostCapped()
  +combinedEvent()
  +subgroups()
  +deterministicTieBreak()
}

class SportCompatibilityTests {
  +outdoorBoxingSwimming()
  +beachVolleyballSwimming()
  +cyclingFootball()
  +runningCalisthenics()
  +swimmingBasketball()
}

class VotingRulesTests {
  +maxThreeVotes()
  +rankedWeights()
  +uniqueSportPerUser()
}

class VotingEligibilityTests {
  +nonParticipantsExcluded()
  +onlyEligibleVotersCount()
}

class DecisionPresentationTests {
  +plainLanguageReason()
  +hideMathByDefault()
  +classifyDecisionType()
}

class ProfileTests {
  +phoneNormalization()
  +profileMapping()
}

FairSportSelectionTests --> FairSportSelection
SportCompatibilityTests --> SportCompatibility
VotingRulesTests --> VotingRules
VotingEligibilityTests --> VotingEligibility
DecisionPresentationTests --> DecisionPresentation
ProfileTests --> ProfilesService
```
