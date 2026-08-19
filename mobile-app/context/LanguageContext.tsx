import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/db";

export type AppLanguage =
  | "English" | "Assamese" | "Bengali" | "Bodo" | "Dogri"
  | "Gujarati" | "Hindi" | "Kannada" | "Kashmiri" | "Kokborok"
  | "Konkani" | "Maithili" | "Malayalam" | "Manipuri" | "Marathi"
  | "Nepali" | "Odia" | "Punjabi" | "Sanskrit" | "Santali"
  | "Sindhi" | "Tamil" | "Telugu" | "Urdu";

export const ALL_LANGUAGES: AppLanguage[] = [
  "English", "Assamese", "Bengali", "Bodo", "Dogri",
  "Gujarati", "Hindi", "Kannada", "Kashmiri", "Kokborok",
  "Konkani", "Maithili", "Malayalam", "Manipuri", "Marathi",
  "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali",
  "Sindhi", "Tamil", "Telugu", "Urdu",
];

export const SUPPORTED_LANGUAGES: AppLanguage[] = ["English", "Bengali", "Hindi", "Kokborok", "Manipuri"];

type Strings = {
  // Profile
  account: string; support: string; editProfile: string; myLocation: string;
  language: string; helpCenter: string; termsOfService: string; privacyPolicy: string;
  signOut: string; youreOnline: string; youreOffline: string; customersCanFind: string;
  wontReceiveBookings: string; registerAsProvider: string; earnMoneyWithSkills: string;
  inviteFriends: string; shareWithFriendsFamily: string; verifiedProvider: string;
  selectCity: string; selectLanguage: string; signOutTitle: string; signOutMessage: string;
  signOutConfirm: string; cancel: string;
  // Home
  hi: string; detectingLocation: string; categories: string;
  nearbySkilled: string; viewAll: string; noProvidersFound: string;
  offerSkills: string; searchPlaceholder: string;
  // Search
  searchSkills: string; availableNow: string; nearest: string;
  topRated: string; mostReviews: string; within: string;
  noProvidersMatch: string; tryAdjustingFilters: string; providersFound: string;
  // Messages
  messages: string; noMessagesYet: string; noMessagesDesc: string;
  findProviders: string; message: string;
  // Notifications
  notifications: string; unread: string; markAllRead: string;
  pushNotifActive: string; noNotificationsYet: string;
  notifDesc: string; justNow: string;
  // Dashboard
  dashboard: string; becomeProvider: string; becomeProviderDesc: string;
  quickActions: string; earnings: string; myListing: string;
  reviews: string; share: string; bookingRequests: string;
  newLabel: string; pending: string; active: string; done: string;
  ratingLabel: string; availableForJobs: string; notAvailable: string;
  online: string; offline: string; estimatedEarnings: string;
  fromCompletedJobs: string; noBookingRequests: string;
  noBookingDesc: string; markDone: string; accept: string;
  decline: string; markComplete: string; markCompleteConfirm: string;
  declineBooking: string; declineBookingConfirm: string;
  service: string; date: string; time: string; budget: string;
  // Additional UI strings
  connectWithSkilled: string;
  hireSkillsTagline: string;
  workers: string;
  servicesLabel: string;
  cities: string;
  welcomeBack: string;
  signInToContinue: string;
  iAmA: string;
  customer: string;
  serviceProvider: string;
  fullName: string;
  enterFullName: string;
  mobileNumber: string;
  enterMobileNumber: string;
  sendOtp: string;
  agreeToTermsPrivacy: string;
  enterAll6Digits: string;
  otpResentSuccess: string;
  otpResendFailed: string;
  networkError: string;
  verifyYourNumber: string;
  weSentOtpTo: string;
  enterCodeBelow: string;
  verifyAndContinue: string;
  resendOtpIn: string;
  resendOtp: string;
  otpValid10Min: string;
  home: string;
  search: string;
  alerts: string;
  profile: string;
  providerUnavailable: string;
  providerNotAcceptingCustomers: string;
  ok: string;
  seeAll: string;
  clear: string;
  allCategories: string;
  searchBySkillOrService: string;
  skilledWorkerFoundNearby: string;
  skilledWorkersFoundNearby: string;
  noProvidersInArea: string;
  deleteConversation: string;
  removeConversationConfirm: string;
  delete: string;
  yesterday: string;
  today: string;
  weekdayMon: string;
  weekdayTue: string;
  weekdayWed: string;
  weekdayThu: string;
  weekdayFri: string;
  weekdaySat: string;
  weekdaySun: string;
  expired: string;
  freeTrial: string;
  paidSubscription: string;
  providerDashboard: string;
  provider: string;
  activeSubscription: string;
  expiredOn: string;
  rechargeRequired: string;
  validUntil: string;
  daysRemaining: string;
  subscriptionExpireInDays: string;
  subscriptionExpireInDay: string;
  renewNowContinue: string;
  completed: string;
  total: string;
  thisMonth: string;
  thisWeek: string;
  customerActivity: string;
  calls: string;
  whatsapp: string;
  views: string;
  latestReviews: string;
  seeAllLower: string;
  noReviewsYet: string;
  completedJobsEarnRatings: string;
  subscription: string;
  shareProfile: string;
  soon: string;
  uploadFailed: string;
  couldNotUploadPhotoRetry: string;
  cameraPermissionRequired: string;
  cameraAccessDenied: string;
  openSettings: string;
  permissionNeeded: string;
  allowCameraProfilePhoto: string;
  allowPhotoLibraryProfile: string;
  takePhoto: string;
  chooseFromLibrary: string;
  removePhoto: string;
  changeProfilePhoto: string;
  chooseASource: string;
  error: string;
  couldNotDeleteAccount: string;
  deleteAccount: string;
  deleteAccountConfirm: string;
  aboutUs: string;
  aboutUsBody: string;
  helpCentre: string;
  helpCentreBody: string;
  termsOfServiceBody: string;
  privacyPolicyBody: string;
  user: string;
  availableForWork: string;
  unavailable: string;
  customersCanDiscover: string;
  profileTemporarilyHidden: string;
  monthly: string;
  quarterly: string;
  halfYearly: string;
  yearly: string;
  activeDaysLeft: string;
  activeDayLeft: string;
  noActiveSubscription: string;
  expiredRenewToGoLive: string;
  expiringInDays: string;
  expiringInDay: string;
  plan: string;
  expires: string;
  daysRemainingLabel: string;
  subscribe: string;
  renew: string;
  customerCare: string;
  callUsAt: string;
  contactCare: string;
  editProviderProfile: string;
  accountDetails: string;
  myDashboard: string;
  earningsBookingsPerformance: string;
  detecting: string;
  tapToEnableGps: string;
  about: string;
  appVersion: string;
  bookingConfirmed: string;
  bookingDeclined: string;
  workDoneAwaiting: string;
  jobConfirmed: string;
  issueReported: string;
  awaitingConfirmation: string;
  newBookingRequest: string;
  bookingRequestSent: string;
  bookingRequest: string;
  amount: string;
  reviewSubmittedCheck: string;
  reviewRequestSent: string;
  customerHasRated: string;
  waitingForCustomerRating: string;
  reviewSubmitted: string;
  thankYouFeedback: string;
  rateFirst: string;
  selectStarBeforeSubmit: string;
  couldNotSubmitReview: string;
  howWasExperience: string;
  shareYourFeedback: string;
  writeCommentOptional: string;
  submitting: string;
  submitReview: string;
  workCompleted: string;
  customerApprovedEarnings: string;
  customerReportedIssue: string;
  awaitingCustomerConfirmation: string;
  completionApproved: string;
  paymentReleased: string;
  resolveWithProvider: string;
  providerSaysWorkDone: string;
  reportIssue: string;
  reportIssueConfirm: string;
  approveCompletion: string;
  approveCompletionConfirm: string;
  approve: string;
  connected: string;
  offlineMode: string;
  signInToChat: string;
  signInToStartMessaging: string;
  sendMessageToStart: string;
  createAccountToMessage: string;
  typeAMessage: string;
  signInToMessage: string;
  bookingUnavailable: string;
  providerNotAcceptingBookings: string;
  failedToAccept: string;
  noActiveBooking: string;
  noAcceptedBookingDesc: string;
  alreadySent: string;
  workCompletedAlreadySent: string;
  failedToMarkComplete: string;
  failedToApprove: string;
  issueNotedContactProvider: string;
  declineThisBookingConfirm: string;
  failedToDecline: string;
  deleteMessage: string;
  removeThisMessage: string;
  rateReviewAlreadySent: string;
  rateYourExperience: string;
  askedYouToRate: string;
  pleaseRateExperience: string;
  ratingRequestSent: string;
  customerPromptedToRate: string;
  newBookingRequestTitle: string;
  newMessage: string;
  sentBookingRequest: string;
  bookingRequestSentBody: string;
  bookingSent: string;
  requestSentToProvider: string;
  bookingRequestSummary: string;
  wantsToBook: string;
  workCompletedFor: string;
  allTime: string;
  earningsChart: string;
  jobsCompleted: string;
  jobCompleted: string;
  noEarningsInPeriod: string;
  avgPerJob: string;
  bestPeriod: string;
  jobsDone: string;
  topService: string;
  fromNJobs: string;
  thisWeekLower: string;
  thisMonthLower: string;
  allTimeLower: string;
  mostEarned: string;
  byService: string;
  completedJobs: string;
  noJobsYet: string;
  completedJobsAppearHere: string;
  pctVsPrev: string;
  week1: string;
  week2: string;
  week3: string;
  week4: string;
  monthJan: string;
  monthFeb: string;
  monthMar: string;
  monthApr: string;
  monthMay: string;
  monthJun: string;
  monthJul: string;
  monthAug: string;
  monthSep: string;
  monthOct: string;
  monthNov: string;
  monthDec: string;
  couldNotUploadPhoto: string;
  allowCameraTakePhoto: string;
  allowPhotoLibrary: string;
  nameRequired: string;
  pleaseEnterName: string;
  saved: string;
  profileUpdated: string;
  couldNotSave: string;
  save: string;
  phoneNumber: string;
  locked: string;
  phoneLockedHint: string;
  saveChanges: string;
  providerNotFound: string;
  notSpecified: string;
  category: string;
  specialization: string;
  newProvider: string;
  nReviews: string;
  yearsExp: string;
  radius: string;
  location: string;
  serviceArea: string;
  charges: string;
  amountPerVisit: string;
  status: string;
  busy: string;
  reviewsComeFromCustomers: string;
  editYourProfile: string;
  call: string;
  inviteHeroSub: string;
  sendInvite: string;
  opensShareApps: string;
  howItWorks: string;
  shareTheApp: string;
  shareAppDesc: string;
  friendSignsUp: string;
  friendSignsUpDesc: string;
  theyreAllSet: string;
  theyreAllSetDesc: string;
  whyShareSkillAd: string;
  growCommunity: string;
  trustedPlatform: string;
  easyToShare: string;
  noInviteLimit: string;
  inviteFriendsToSkillAd: string;
  shareMessageLine1: string;
  shareMessageLine2: string;
  downloadSkillAdNow: string;
  kmRadius: string;
  workingRadius: string;
  workingRadiusHint: string;
  nKm: string;
  selectACategory: string;
  selectSkillCategory: string;
  searchCategory: string;
  noCategoriesFound: string;
  photoUploadFailed: string;
  photoUploadFailedDesc: string;
  pleaseAllowPhotoLibrary: string;
  pleaseAllowCamera: string;
  uploadPhoto: string;
  chooseHowAddPhoto: string;
  pleaseEnterDisplayName: string;
  pleaseSelectSkillCategory: string;
  pleaseEnterExperience: string;
  atLeast20Chars: string;
  profileUpdatedTitle: string;
  providerProfileSaved: string;
  updateSkillsProfile: string;
  showcaseSkillsGetHired: string;
  displayName: string;
  displayNamePlaceholder: string;
  serviceLocation: string;
  serviceLocationPlaceholder: string;
  typeOrUseGps: string;
  skillCategory: string;
  subcategorySpecialization: string;
  subcategoryPlaceholder: string;
  yearsOfExperience: string;
  yearsExperiencePlaceholder: string;
  servicesOffered: string;
  servicesOfferedPlaceholder: string;
  serviceDescription: string;
  serviceDescriptionPlaceholder: string;
  profileColor: string;
  serviceAreaPlaceholder: string;
  serviceChargeOptional: string;
  serviceChargePlaceholder: string;
  profilePhoto: string;
  uploadingPhoto: string;
  photoAdded: string;
  addProfilePhoto: string;
  photoHintEdit: string;
  photoHintNew: string;
  submitRegistration: string;
  billedEveryMonth: string;
  billedEvery3Months: string;
  billedEvery6Months: string;
  billedOnceAYear: string;
  popular: string;
  bestValue: string;
  featureAppearInSearch: string;
  featureLocationMatching: string;
  featureUnlimitedMessaging: string;
  featureInstantBookingNotifs: string;
  featureCollectRatings: string;
  featureEarningsAnalytics: string;
  featureVerifiedBadge: string;
  upi: string;
  debitCreditCard: string;
  netBanking: string;
  mobileWallet: string;
  upiDesc: string;
  cardDesc: string;
  netBankingDesc: string;
  walletDesc: string;
  paymentSuccessful: string;
  subscriptionNowActive: string;
  startEarning: string;
  accountInactive: string;
  accountInactiveDesc: string;
  continueLabel: string;
  required: string;
  pleaseEnterUtr: string;
  notSignedIn: string;
  pleaseSignInFirst: string;
  couldNotSubmitRenewal: string;
  subscriptionActivated: string;
  requestRejected: string;
  clarificationNeeded: string;
  requestSubmitted: string;
  subscriptionActiveDesc: string;
  paymentNotVerified: string;
  adminRequestedInfo: string;
  renewalSubmittedDesc: string;
  utrTxnId: string;
  paymentDate: string;
  pendingReview: string;
  submitAgain: string;
  goToApp: string;
  continueToApp: string;
  activateYourSubscription: string;
  activateSubscriptionSub: string;
  whatsIncluded: string;
  paymentMethod: string;
  orderSummary: string;
  skillAdProPlan: string;
  subtotal: string;
  gst18: string;
  payAmountSecurely: string;
  securedBySsl: string;
  skipActivateLater: string;
  whereToPay: string;
  upiPayment: string;
  upiApps: string;
  upiId: string;
  name: string;
  bankTransfer: string;
  neftImpsRtgs: string;
  bank: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  paymentDetailsBeingSetUp: string;
  paymentSummary: string;
  planLabel: string;
  submitPaymentDetails: string;
  utrTransactionId: string;
  utrPlaceholder: string;
  utrHint: string;
  dateFormatPlaceholder: string;
  amountPaid: string;
  notesOptional: string;
  notesPlaceholder: string;
  submitForVerification: string;
  requestReviewed24h: string;
  skipActivateLaterFromProfile: string;
  chooseYourPlan: string;
  oops: string;
  screenDoesntExist: string;
  goToHomeScreen: string;
  back: string;
  providerDetails: string;
  toBeConfirmed: string;
  tomorrow: string;
  requestBooking: string;
  withName: string;
  dateAndTime: string;
  confirm: string;
  whatServiceNeed: string;
  other: string;
  describeServiceNeed: string;
  budgetOptional: string;
  enterBudgetOrBlank: string;
  selectADate: string;
  selectATime: string;
  bookingSummary: string;
  reviewBeforeSending: string;
  addNoteOptional: string;
  bookingRequestNote: string;
  nextDateTime: string;
  reviewBooking: string;
  sendBookingRequest: string;
  time800am: string;
  time900am: string;
  time1000am: string;
  time1100am: string;
  time1200pm: string;
  time100pm: string;
  time200pm: string;
  time300pm: string;
  time400pm: string;
  time500pm: string;
  time600pm: string;
  time700pm: string;
  pleaseSelectStarRating: string;
  mustSignInToReview: string;
  failedToSubmitReview: string;
  ratingPoor: string;
  ratingFair: string;
  ratingGood: string;
  ratingGreat: string;
  ratingExcellent: string;
  rateName: string;
  howWasExperienceHelp: string;
  shareDetailsOptional: string;
  thanksForSharing: string;
  reviewsRequireAccount: string;
  you: string;
  kmAway: string;
  findSkilledWorkersNearYou: string;
  uploadFirstAd: string;
  contentNotAvailable: string;
  somethingWentWrong: string;
  pleaseReloadApp: string;
  tryAgain: string;
  errorDetails: string;
  stayUpdatedBookings: string;
  addPhoto: string;
  viewErrorDetails: string;
  closeErrorDetails: string;
  anonymous: string;
  failedToSubmit: string;
};

/** Keys actually present on each bundled language object (through `budget`). */
type CoreStrings = Pick<
  Strings,
  | "account"
  | "support"
  | "editProfile"
  | "myLocation"
  | "language"
  | "helpCenter"
  | "termsOfService"
  | "privacyPolicy"
  | "signOut"
  | "youreOnline"
  | "youreOffline"
  | "customersCanFind"
  | "wontReceiveBookings"
  | "registerAsProvider"
  | "earnMoneyWithSkills"
  | "inviteFriends"
  | "shareWithFriendsFamily"
  | "verifiedProvider"
  | "selectCity"
  | "selectLanguage"
  | "signOutTitle"
  | "signOutMessage"
  | "signOutConfirm"
  | "cancel"
  | "hi"
  | "detectingLocation"
  | "categories"
  | "nearbySkilled"
  | "viewAll"
  | "noProvidersFound"
  | "offerSkills"
  | "searchPlaceholder"
  | "searchSkills"
  | "availableNow"
  | "nearest"
  | "topRated"
  | "mostReviews"
  | "within"
  | "noProvidersMatch"
  | "tryAdjustingFilters"
  | "providersFound"
  | "messages"
  | "noMessagesYet"
  | "noMessagesDesc"
  | "findProviders"
  | "message"
  | "notifications"
  | "unread"
  | "markAllRead"
  | "pushNotifActive"
  | "noNotificationsYet"
  | "notifDesc"
  | "justNow"
  | "dashboard"
  | "becomeProvider"
  | "becomeProviderDesc"
  | "quickActions"
  | "earnings"
  | "myListing"
  | "reviews"
  | "share"
  | "bookingRequests"
  | "newLabel"
  | "pending"
  | "active"
  | "done"
  | "ratingLabel"
  | "availableForJobs"
  | "notAvailable"
  | "online"
  | "offline"
  | "estimatedEarnings"
  | "fromCompletedJobs"
  | "noBookingRequests"
  | "noBookingDesc"
  | "markDone"
  | "accept"
  | "decline"
  | "markComplete"
  | "markCompleteConfirm"
  | "declineBooking"
  | "declineBookingConfirm"
  | "service"
  | "date"
  | "time"
  | "budget"
>;

const bundledTranslations: Record<AppLanguage, CoreStrings> = {
  English: {
    account: "Account", support: "Support", editProfile: "Edit Profile",
    myLocation: "My Location", language: "Language", helpCenter: "Help Center",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", signOut: "Sign Out",
    youreOnline: "You're Online", youreOffline: "You're Offline",
    customersCanFind: "Customers can find & book you",
    wontReceiveBookings: "You won't receive new bookings",
    registerAsProvider: "Register as Provider", earnMoneyWithSkills: "Earn money with your skills",
    inviteFriends: "Invite Friends", shareWithFriendsFamily: "Share SkillAd with friends & family",
    verifiedProvider: "Verified Provider", selectCity: "Select Your City",
    selectLanguage: "Select Language", signOutTitle: "Sign Out",
    signOutMessage: "Are you sure you want to sign out?", signOutConfirm: "Sign Out", cancel: "Cancel",
    hi: "Hi,", detectingLocation: "Detecting location...", categories: "Categories",
    nearbySkilled: "Nearby Skilled Workers", viewAll: "View All",
    noProvidersFound: "No providers found", offerSkills: "Offer Skills",
    searchPlaceholder: "Search for a skill or service...",
    searchSkills: "Search skills, services...", availableNow: "Available Now",
    nearest: "Nearest", topRated: "Top Rated", mostReviews: "Most Reviews",
    within: "Within", noProvidersMatch: "No providers match your filters",
    tryAdjustingFilters: "Try adjusting your search or filters", providersFound: "providers found",
    messages: "Messages", noMessagesYet: "No messages yet",
    noMessagesDesc: "Find a skilled provider and tap Message to start a conversation.",
    findProviders: "Find Providers", message: "Message",
    notifications: "Notifications", unread: "unread", markAllRead: "Mark all read",
    pushNotifActive: "Push notifications active — booking alerts delivered instantly",
    noNotificationsYet: "No notifications yet",
    notifDesc: "You'll be notified when customers send booking requests.",
    justNow: "Just now",
    dashboard: "Dashboard", becomeProvider: "Become a Provider",
    becomeProviderDesc: "Register your skills and start receiving booking requests from customers nearby.",
    quickActions: "Quick Actions", earnings: "Earnings", myListing: "My Listing",
    reviews: "Reviews", share: "Share", bookingRequests: "Booking Requests",
    newLabel: "new", pending: "Pending", active: "Active", done: "Done",
    ratingLabel: "Rating", availableForJobs: "Available for jobs",
    notAvailable: "Not available", online: "Online", offline: "Offline",
    estimatedEarnings: "Estimated Earnings", fromCompletedJobs: "From completed jobs",
    noBookingRequests: "No booking requests yet",
    noBookingDesc: "When customers send booking requests, they'll appear here.",
    markDone: "Mark Done", accept: "Accept", decline: "Decline",
    markComplete: "Mark Complete", markCompleteConfirm: "Mark this job as completed?",
    declineBooking: "Decline Booking",
    declineBookingConfirm: "Are you sure you want to decline this request?",
    service: "Service", date: "Date", time: "Time", budget: "Budget",
  },

  Assamese: {
    account: "একাউণ্ট", support: "সহায়", editProfile: "প্ৰ'ফাইল সম্পাদনা কৰক",
    myLocation: "মোৰ অৱস্থান", language: "ভাষা", helpCenter: "সহায় কেন্দ্ৰ",
    termsOfService: "সেৱাৰ চৰ্ত", privacyPolicy: "গোপনীয়তা নীতি", signOut: "চাইন আউট",
    youreOnline: "আপুনি অনলাইনত আছে", youreOffline: "আপুনি অফলাইনত আছে",
    customersCanFind: "গ্ৰাহকে আপোনাক বিচাৰি পাব পাৰে",
    wontReceiveBookings: "আপুনি নতুন বুকিং নাপাব",
    registerAsProvider: "প্ৰদানকাৰী হিচাপে পঞ্জীয়ন কৰক",
    earnMoneyWithSkills: "আপোনাৰ দক্ষতাৰে উপাৰ্জন কৰক",
    inviteFriends: "বন্ধুক আমন্ত্ৰণ জনাওক",
    shareWithFriendsFamily: "বন্ধু আৰু পৰিয়ালৰ সৈতে SkillAd শ্বেয়াৰ কৰক",
    verifiedProvider: "যাচাইকৃত প্ৰদানকাৰী", selectCity: "আপোনাৰ চহৰ বাছক",
    selectLanguage: "ভাষা বাছক", signOutTitle: "চাইন আউট",
    signOutMessage: "আপুনি চাইন আউট কৰিব বিচাৰেনে?", signOutConfirm: "চাইন আউট", cancel: "বাতিল",
    hi: "নমস্কাৰ,", detectingLocation: "অৱস্থান বিচাৰি আছে...", categories: "শ্ৰেণী",
    nearbySkilled: "ওচৰৰ দক্ষ কৰ্মী", viewAll: "সকলো চাওক",
    noProvidersFound: "কোনো প্ৰদানকাৰী পোৱা নগ'ল", offerSkills: "দক্ষতা আগবঢ়াওক",
    searchPlaceholder: "দক্ষতা বা সেৱা বিচাৰক...",
    searchSkills: "দক্ষতা, সেৱা বিচাৰক...", availableNow: "এতিয়া উপলব্ধ",
    nearest: "সবাতোকৈ ওচৰৰ", topRated: "শীৰ্ষ ৰেটেড", mostReviews: "সৰ্বাধিক পৰ্যালোচনা",
    within: "ভিতৰত", noProvidersMatch: "কোনো প্ৰদানকাৰী ফিল্টাৰৰ সৈতে মিলা নাই",
    tryAdjustingFilters: "আপোনাৰ অনুসন্ধান বা ফিল্টাৰ সলনি কৰক", providersFound: "প্ৰদানকাৰী পোৱা গ'ল",
    messages: "বাৰ্তা", noMessagesYet: "এতিয়ালৈ কোনো বাৰ্তা নাই",
    noMessagesDesc: "এজন দক্ষ প্ৰদানকাৰী বিচাৰক আৰু কথা-বতৰা আৰম্ভ কৰক।",
    findProviders: "প্ৰদানকাৰী বিচাৰক", message: "বাৰ্তা",
    notifications: "জাননী", unread: "অপঠিত", markAllRead: "সকলো পঢ়া বুলি চিহ্নিত কৰক",
    pushNotifActive: "পুছ জাননী সক্ৰিয় — বুকিং সতৰ্কবাৰ্তা তৎক্ষণাৎ পোৱা যায়",
    noNotificationsYet: "এতিয়ালৈ কোনো জাননী নাই",
    notifDesc: "গ্ৰাহকে বুকিং অনুৰোধ পঠালে আপোনাক জনোৱা হ'ব।",
    justNow: "এইমাত্ৰ",
    dashboard: "ডেছব'ৰ্ড", becomeProvider: "প্ৰদানকাৰী হওক",
    becomeProviderDesc: "আপোনাৰ দক্ষতা পঞ্জীয়ন কৰক আৰু ওচৰৰ গ্ৰাহকৰ পৰা বুকিং পাওক।",
    quickActions: "দ্ৰুত কাৰ্যক্ৰম", earnings: "উপাৰ্জন", myListing: "মোৰ তালিকা",
    reviews: "পৰ্যালোচনা", share: "শ্বেয়াৰ", bookingRequests: "বুকিং অনুৰোধ",
    newLabel: "নতুন", pending: "অপেক্ষাৰত", active: "সক্ৰিয়", done: "সম্পন্ন",
    ratingLabel: "ৰেটিং", availableForJobs: "কামৰ বাবে উপলব্ধ",
    notAvailable: "উপলব্ধ নহয়", online: "অনলাইন", offline: "অফলাইন",
    estimatedEarnings: "অনুমানিত উপাৰ্জন", fromCompletedJobs: "সম্পন্ন কামৰ পৰা",
    noBookingRequests: "এতিয়ালৈ কোনো বুকিং অনুৰোধ নাই",
    noBookingDesc: "গ্ৰাহকে বুকিং অনুৰোধ পঠালে ইয়াত দেখা যাব।",
    markDone: "সম্পন্ন কৰক", accept: "গ্ৰহণ কৰক", decline: "প্ৰত্যাখ্যান",
    markComplete: "সম্পন্ন চিহ্নিত কৰক", markCompleteConfirm: "এই কামটো সম্পন্ন কৰিবনে?",
    declineBooking: "বুকিং প্ৰত্যাখ্যান",
    declineBookingConfirm: "আপুনি এই অনুৰোধ প্ৰত্যাখ্যান কৰিব বিচাৰেনে?",
    service: "সেৱা", date: "তাৰিখ", time: "সময়", budget: "বাজেট",
  },

  Bengali: {
    account: "অ্যাকাউন্ট", support: "সাহায্য", editProfile: "প্রোফাইল সম্পাদনা করুন",
    myLocation: "আমার অবস্থান", language: "ভাষা", helpCenter: "সাহায্য কেন্দ্র",
    termsOfService: "সেবার শর্তাবলী", privacyPolicy: "গোপনীয়তা নীতি", signOut: "সাইন আউট",
    youreOnline: "আপনি অনলাইনে আছেন", youreOffline: "আপনি অফলাইনে আছেন",
    customersCanFind: "গ্রাহকরা আপনাকে খুঁজে পাবেন",
    wontReceiveBookings: "আপনি নতুন বুকিং পাবেন না",
    registerAsProvider: "প্রদানকারী হিসেবে নিবন্ধন করুন",
    earnMoneyWithSkills: "আপনার দক্ষতা দিয়ে আয় করুন",
    inviteFriends: "বন্ধুদের আমন্ত্রণ জানান",
    shareWithFriendsFamily: "বন্ধু ও পরিবারের সাথে SkillAd শেয়ার করুন",
    verifiedProvider: "যাচাইকৃত প্রদানকারী", selectCity: "আপনার শহর বেছে নিন",
    selectLanguage: "ভাষা বেছে নিন", signOutTitle: "সাইন আউট",
    signOutMessage: "আপনি কি সাইন আউট করতে চান?", signOutConfirm: "সাইন আউট", cancel: "বাতিল",
    hi: "হ্যালো,", detectingLocation: "অবস্থান নির্ণয় হচ্ছে...", categories: "বিভাগ",
    nearbySkilled: "কাছের দক্ষ কর্মী", viewAll: "সব দেখুন",
    noProvidersFound: "কোনো প্রদানকারী পাওয়া যায়নি", offerSkills: "দক্ষতা অফার করুন",
    searchPlaceholder: "দক্ষতা বা সেবা খুঁজুন...",
    searchSkills: "দক্ষতা, সেবা খুঁজুন...", availableNow: "এখন উপলব্ধ",
    nearest: "সবচেয়ে কাছের", topRated: "সেরা রেটেড", mostReviews: "সর্বাধিক রিভিউ",
    within: "মধ্যে", noProvidersMatch: "কোনো প্রদানকারী ফিল্টারের সাথে মেলে না",
    tryAdjustingFilters: "আপনার অনুসন্ধান বা ফিল্টার পরিবর্তন করুন", providersFound: "প্রদানকারী পাওয়া গেছে",
    messages: "বার্তা", noMessagesYet: "এখনো কোনো বার্তা নেই",
    noMessagesDesc: "একজন দক্ষ প্রদানকারী খুঁজুন এবং কথোপকথন শুরু করুন।",
    findProviders: "প্রদানকারী খুঁজুন", message: "বার্তা",
    notifications: "বিজ্ঞপ্তি", unread: "অপঠিত", markAllRead: "সব পঠিত করুন",
    pushNotifActive: "পুশ বিজ্ঞপ্তি সক্রিয় — বুকিং সতর্কতা তাৎক্ষণিকভাবে পাবেন",
    noNotificationsYet: "এখনো কোনো বিজ্ঞপ্তি নেই",
    notifDesc: "গ্রাহকরা বুকিং অনুরোধ পাঠালে আপনাকে জানানো হবে।",
    justNow: "এইমাত্র",
    dashboard: "ড্যাশবোর্ড", becomeProvider: "প্রদানকারী হন",
    becomeProviderDesc: "আপনার দক্ষতা নিবন্ধন করুন এবং কাছের গ্রাহকদের কাছ থেকে বুকিং পান।",
    quickActions: "দ্রুত কার্যক্রম", earnings: "আয়", myListing: "আমার তালিকা",
    reviews: "রিভিউ", share: "শেয়ার", bookingRequests: "বুকিং অনুরোধ",
    newLabel: "নতুন", pending: "অপেক্ষমাণ", active: "সক্রিয়", done: "সম্পন্ন",
    ratingLabel: "রেটিং", availableForJobs: "কাজের জন্য উপলব্ধ",
    notAvailable: "উপলব্ধ নয়", online: "অনলাইন", offline: "অফলাইন",
    estimatedEarnings: "আনুমানিক আয়", fromCompletedJobs: "সম্পন্ন কাজ থেকে",
    noBookingRequests: "এখনো কোনো বুকিং অনুরোধ নেই",
    noBookingDesc: "গ্রাহকরা বুকিং অনুরোধ পাঠালে এখানে দেখা যাবে।",
    markDone: "সম্পন্ন করুন", accept: "গ্রহণ করুন", decline: "প্রত্যাখ্যান",
    markComplete: "সম্পন্ন চিহ্নিত করুন", markCompleteConfirm: "এই কাজটি সম্পন্ন করবেন?",
    declineBooking: "বুকিং প্রত্যাখ্যান",
    declineBookingConfirm: "আপনি কি এই অনুরোধ প্রত্যাখ্যান করতে চান?",
    service: "সেবা", date: "তারিখ", time: "সময়", budget: "বাজেট",
  },

  Bodo: {
    account: "Account", support: "Sohay", editProfile: "Profile Edit Phnai",
    myLocation: "Nwng Gona", language: "Kham", helpCenter: "Sohay Kendra",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", signOut: "Sign Out",
    youreOnline: "Nwng Online", youreOffline: "Nwng Offline",
    customersCanFind: "Customer nwngbai hafaibai", wontReceiveBookings: "Nwng booking thiphaima",
    registerAsProvider: "Provider Register Phnai", earnMoneyWithSkills: "Skill diya taka kama",
    inviteFriends: "Mohojan Invite", shareWithFriendsFamily: "Mohojanma SkillAd share",
    verifiedProvider: "Verified Provider", selectCity: "Gona Select Phnai",
    selectLanguage: "Kham Select Phnai", signOutTitle: "Sign Out",
    signOutMessage: "Sign out phaibai kha?", signOutConfirm: "Sign Out", cancel: "Nanai",
    hi: "Namaskaar,", detectingLocation: "Gona khwbwi...", categories: "Categories",
    nearbySkilled: "Aasal Skilled Worker", viewAll: "Hobnai Bai",
    noProvidersFound: "Provider thiphaima", offerSkills: "Skill Dinai",
    searchPlaceholder: "Skill baa seva khwi...",
    searchSkills: "Skill, seva khwi...", availableNow: "Awthai Available",
    nearest: "Sobseba Aasal", topRated: "Top Rated", mostReviews: "Most Reviews",
    within: "Gwdan", noProvidersMatch: "Provider filter sannai milo nai",
    tryAdjustingFilters: "Filter badlao", providersFound: "provider thi",
    messages: "Message", noMessagesYet: "Message nanai",
    noMessagesDesc: "Provider khwi, message phnai.",
    findProviders: "Provider Khwi", message: "Message",
    notifications: "Notification", unread: "Nphdwi", markAllRead: "Hobnanai Phrwi",
    pushNotifActive: "Push notification active — booking alert aaabar pabo",
    noNotificationsYet: "Notification nanai",
    notifDesc: "Customer booking request phathalao nwng janol.",
    justNow: "Awthai",
    dashboard: "Dashboard", becomeProvider: "Provider Habai",
    becomeProviderDesc: "Skill register phnai, aasal customer paikhri booking pabo.",
    quickActions: "Quick Actions", earnings: "Taka", myListing: "Nwng List",
    reviews: "Reviews", share: "Share", bookingRequests: "Booking Request",
    newLabel: "Nwi", pending: "Pending", active: "Active", done: "Shamai",
    ratingLabel: "Rating", availableForJobs: "Job hobai available",
    notAvailable: "Available nanai", online: "Online", offline: "Offline",
    estimatedEarnings: "Taka Andaz", fromCompletedJobs: "Shamai job paikhri",
    noBookingRequests: "Booking request nanai",
    noBookingDesc: "Customer booking request phathalao, aabar gonab.",
    markDone: "Shamai", accept: "Maan", decline: "Nanai",
    markComplete: "Shamai Mark", markCompleteConfirm: "Kaamni shamai?",
    declineBooking: "Booking Decline",
    declineBookingConfirm: "Request decline phnai khwma?",
    service: "Seva", date: "Din", time: "Samay", budget: "Budget",
  },

  Dogri: {
    account: "खाता", support: "सहायता", editProfile: "प्रोफ़ाइल बदलो",
    myLocation: "मेरी थाह", language: "बोली", helpCenter: "मदद केंद्र",
    termsOfService: "सेवा दियां शर्तां", privacyPolicy: "गुप्तता नीति", signOut: "साइन आउट",
    youreOnline: "तुसीं ऑनलाइन औ", youreOffline: "तुसीं ऑफलाइन औ",
    customersCanFind: "ग्राहक तुआनूं लब्भ सकदे न",
    wontReceiveBookings: "तुआनूं नवीं बुकिंग नेईं आवनी",
    registerAsProvider: "प्रदाता दे रूप च पंजीकरण करो",
    earnMoneyWithSkills: "अपने हुनर कन्नै कमाओ",
    inviteFriends: "दोस्तां नूं आमंत्रण दओ",
    shareWithFriendsFamily: "दोस्तां ते परिवार कन्नै SkillAd साझा करो",
    verifiedProvider: "सत्यापित प्रदाता", selectCity: "अपना शहर चुनो",
    selectLanguage: "बोली चुनो", signOutTitle: "साइन आउट",
    signOutMessage: "क्या तुसीं साइन आउट करना चांह्दे औ?", signOutConfirm: "साइन आउट", cancel: "रद्द करो",
    hi: "नमस्ते,", detectingLocation: "थाह लब्भी जा ही ऐ...", categories: "श्रेणियां",
    nearbySkilled: "नेड़े दे हुनरमंद", viewAll: "सब देखो",
    noProvidersFound: "कोई प्रदाता नेईं मिल्या", offerSkills: "हुनर दओ",
    searchPlaceholder: "हुनर या सेवा लब्भो...",
    searchSkills: "हुनर, सेवाएं लब्भो...", availableNow: "हून उपलब्ध",
    nearest: "सबतों नेड़ा", topRated: "शीर्ष रेटेड", mostReviews: "सबतों समीक्षाएं",
    within: "अंदर", noProvidersMatch: "कोई प्रदाता फिल्टर कन्नै नेईं मिल्या",
    tryAdjustingFilters: "खोज जां फिल्टर बदलो", providersFound: "प्रदाता मिले",
    messages: "संदेश", noMessagesYet: "हाल च कोई संदेश नेईं",
    noMessagesDesc: "हुनरमंद प्रदाता लब्भो ते गल्लबात शुरू करो।",
    findProviders: "प्रदाता लब्भो", message: "संदेश",
    notifications: "सूचनाएं", unread: "अनपड़ी", markAllRead: "सब पड़ी दे रूप च चिह्नित करो",
    pushNotifActive: "पुश सूचना सक्रिय — बुकिंग अलर्ट तुरंत मिलने",
    noNotificationsYet: "हाल च कोई सूचना नेईं",
    notifDesc: "जदूं ग्राहक बुकिंग अनुरोध घल्लन, तुआनूं दसेया जाग।",
    justNow: "हून",
    dashboard: "डैशबोर्ड", becomeProvider: "प्रदाता बनो",
    becomeProviderDesc: "अपना हुनर पंजीकृत करो ते नेड़े दे ग्राहकां थें बुकिंग लओ।",
    quickActions: "त्वरित क्रियाएं", earnings: "कमाई", myListing: "मेरी सूची",
    reviews: "समीक्षाएं", share: "साझा करो", bookingRequests: "बुकिंग अनुरोध",
    newLabel: "नवां", pending: "लंबित", active: "सक्रिय", done: "पूर्ण",
    ratingLabel: "रेटिंग", availableForJobs: "कम्म लेई उपलब्ध",
    notAvailable: "उपलब्ध नेईं", online: "ऑनलाइन", offline: "ऑफलाइन",
    estimatedEarnings: "अनुमानित कमाई", fromCompletedJobs: "पूरे कम्मां थें",
    noBookingRequests: "हाल च कोई बुकिंग अनुरोध नेईं",
    noBookingDesc: "जदूं ग्राहक बुकिंग अनुरोध घल्लन, उ इत्थे दिखेन।",
    markDone: "पूरा करो", accept: "मंजूर करो", decline: "मना करो",
    markComplete: "पूरा चिह्नित करो", markCompleteConfirm: "एह कम्म पूरा करना?",
    declineBooking: "बुकिंग मना करो",
    declineBookingConfirm: "क्या तुसीं एह अनुरोध मना करना चांह्दे औ?",
    service: "सेवा", date: "तारीख", time: "समा", budget: "बजट",
  },

  Gujarati: {
    account: "ખાતું", support: "સહાય", editProfile: "પ્રોફાઇલ સંપાદિત કરો",
    myLocation: "મારું સ્થાન", language: "ભાષા", helpCenter: "મદદ કેન્દ્ર",
    termsOfService: "સેવાની શરતો", privacyPolicy: "ગોપનીયતા નીતિ", signOut: "સાઇન આઉટ",
    youreOnline: "તમે ઓનલાઇન છો", youreOffline: "તમે ઓફલાઇન છો",
    customersCanFind: "ગ્રાહકો તમને શોધી શકે છે",
    wontReceiveBookings: "તમને નવી બુકિંગ નહીં મળે",
    registerAsProvider: "પ્રોવાઇડર તરીકે નોંધણી કરો",
    earnMoneyWithSkills: "તમારી કૌશલ્ય વડે કમાઓ",
    inviteFriends: "મિત્રોને આમંત્રિત કરો",
    shareWithFriendsFamily: "મિત્રો અને પરિવાર સાથે SkillAd શેર કરો",
    verifiedProvider: "ચકાસેલ પ્રોવાઇડર", selectCity: "તમારું શહેર પસંદ કરો",
    selectLanguage: "ભાષા પસંદ કરો", signOutTitle: "સાઇન આઉટ",
    signOutMessage: "શું તમે સાઇન આઉટ કરવા માગો છો?", signOutConfirm: "સાઇન આઉટ", cancel: "રદ કરો",
    hi: "નમસ્તે,", detectingLocation: "સ્થાન શોધી રહ્યા છે...", categories: "શ્રેણીઓ",
    nearbySkilled: "નજીકના કુશળ કારીગર", viewAll: "બધા જુઓ",
    noProvidersFound: "કોઈ પ્રોવાઇડર મળ્યા નહીં", offerSkills: "કૌશલ્ય ઓફર કરો",
    searchPlaceholder: "કૌશલ્ય અથવા સેવા શોધો...",
    searchSkills: "કૌશલ્ય, સેવા શોધો...", availableNow: "અત્યારે ઉપલબ્ધ",
    nearest: "સૌથી નજીક", topRated: "ટોચ રેટ", mostReviews: "સૌથી વધુ સમીક્ષા",
    within: "અંદર", noProvidersMatch: "ફિલ્ટર સાથે કોઈ પ્રોવાઇડર મળ્યા નહીં",
    tryAdjustingFilters: "તમારી શોધ અથવા ફિલ્ટર બદલો", providersFound: "પ્રોવાઇડર મળ્યા",
    messages: "સંદેશ", noMessagesYet: "હજી કોઈ સંદેશ નથી",
    noMessagesDesc: "કુશળ પ્રોવાઇડર શોધો અને વાતચીત શરૂ કરો.",
    findProviders: "પ્રોવાઇડર શોધો", message: "સંદેશ",
    notifications: "સૂચનાઓ", unread: "અવાંચ્યું", markAllRead: "બધા વાંચ્યા ચિહ્નિત કરો",
    pushNotifActive: "પુશ સૂચનાઓ સક્રિય — બુકિંગ ચેતવણી તરત મળે છે",
    noNotificationsYet: "હજી કોઈ સૂચના નથી",
    notifDesc: "ગ્રાહકો બુકિંગ વિનંતી મોકલે ત્યારે તમને જાણ કરવામાં આવશે.",
    justNow: "હમણાં",
    dashboard: "ડૅશબોર્ડ", becomeProvider: "પ્રોવાઇડર બનો",
    becomeProviderDesc: "તમારી કૌશલ્ય નોંધો અને નજીકના ગ્રાહકો પાસેથી બુકિંગ મેળવો.",
    quickActions: "ઝડપી ક્રિયાઓ", earnings: "કમાણી", myListing: "મારી યાદી",
    reviews: "સમીક્ષા", share: "શેર", bookingRequests: "બુકિંગ વિનંતી",
    newLabel: "નવી", pending: "બાકી", active: "સક્રિય", done: "પૂર્ણ",
    ratingLabel: "રેટિંગ", availableForJobs: "કામ માટે ઉપલબ્ધ",
    notAvailable: "ઉપલબ્ધ નથી", online: "ઓનલાઇન", offline: "ઓફલાઇન",
    estimatedEarnings: "અંદાજિત કમાણી", fromCompletedJobs: "પૂર્ણ કામ થી",
    noBookingRequests: "હજી કોઈ બુકિંગ વિનંતી નથી",
    noBookingDesc: "ગ્રાહકો બુકિંગ વિનંતી મોકલે ત્યારે અહીં દેખાશે.",
    markDone: "પૂર્ણ કરો", accept: "સ્વીકારો", decline: "ના",
    markComplete: "પૂર્ણ ચિહ્નિત કરો", markCompleteConfirm: "આ કામ પૂર્ણ કરો?",
    declineBooking: "બુકિંગ ના",
    declineBookingConfirm: "શું તમે આ વિનંતી નકારવા માગો છો?",
    service: "સેવા", date: "તારીખ", time: "સમય", budget: "બજેટ",
  },

  Hindi: {
    account: "खाता", support: "सहायता", editProfile: "प्रोफ़ाइल संपादित करें",
    myLocation: "मेरा स्थान", language: "भाषा", helpCenter: "सहायता केंद्र",
    termsOfService: "सेवा की शर्तें", privacyPolicy: "गोपनीयता नीति", signOut: "साइन आउट",
    youreOnline: "आप ऑनलाइन हैं", youreOffline: "आप ऑफलाइन हैं",
    customersCanFind: "ग्राहक आपको ढूंढ सकते हैं",
    wontReceiveBookings: "आपको नई बुकिंग नहीं मिलेगी",
    registerAsProvider: "प्रदाता के रूप में पंजीकरण करें",
    earnMoneyWithSkills: "अपने कौशल से पैसे कमाएं",
    inviteFriends: "दोस्तों को आमंत्रित करें",
    shareWithFriendsFamily: "दोस्तों और परिवार के साथ SkillAd शेयर करें",
    verifiedProvider: "सत्यापित प्रदाता", selectCity: "अपना शहर चुनें",
    selectLanguage: "भाषा चुनें", signOutTitle: "साइन आउट",
    signOutMessage: "क्या आप साइन आउट करना चाहते हैं?", signOutConfirm: "साइन आउट", cancel: "रद्द करें",
    hi: "नमस्ते,", detectingLocation: "स्थान पता कर रहे हैं...", categories: "श्रेणियाँ",
    nearbySkilled: "पास के कुशल कारीगर", viewAll: "सभी देखें",
    noProvidersFound: "कोई प्रदाता नहीं मिला", offerSkills: "कौशल दें",
    searchPlaceholder: "कौशल या सेवा खोजें...",
    searchSkills: "कौशल, सेवाएं खोजें...", availableNow: "अभी उपलब्ध",
    nearest: "सबसे पास", topRated: "सर्वश्रेष्ठ रेटेड", mostReviews: "सर्वाधिक समीक्षाएं",
    within: "के अंदर", noProvidersMatch: "कोई प्रदाता आपके फ़िल्टर से मेल नहीं खाता",
    tryAdjustingFilters: "अपनी खोज या फ़िल्टर बदलें", providersFound: "प्रदाता मिले",
    messages: "संदेश", noMessagesYet: "अभी कोई संदेश नहीं",
    noMessagesDesc: "किसी कुशल प्रदाता को खोजें और संवाद शुरू करें।",
    findProviders: "प्रदाता खोजें", message: "संदेश",
    notifications: "सूचनाएं", unread: "अपठित", markAllRead: "सभी पढ़ा हुआ करें",
    pushNotifActive: "पुश नोटिफिकेशन सक्रिय — बुकिंग अलर्ट तुरंत मिलेंगे",
    noNotificationsYet: "अभी कोई सूचना नहीं",
    notifDesc: "जब ग्राहक बुकिंग अनुरोध भेजेंगे, आपको सूचित किया जाएगा।",
    justNow: "अभी",
    dashboard: "डैशबोर्ड", becomeProvider: "प्रदाता बनें",
    becomeProviderDesc: "अपने कौशल पंजीकृत करें और पास के ग्राहकों से बुकिंग प्राप्त करें।",
    quickActions: "त्वरित क्रियाएं", earnings: "कमाई", myListing: "मेरी सूची",
    reviews: "समीक्षाएं", share: "साझा करें", bookingRequests: "बुकिंग अनुरोध",
    newLabel: "नया", pending: "लंबित", active: "सक्रिय", done: "पूर्ण",
    ratingLabel: "रेटिंग", availableForJobs: "काम के लिए उपलब्ध",
    notAvailable: "उपलब्ध नहीं", online: "ऑनलाइन", offline: "ऑफलाइन",
    estimatedEarnings: "अनुमानित कमाई", fromCompletedJobs: "पूर्ण कार्यों से",
    noBookingRequests: "अभी कोई बुकिंग अनुरोध नहीं",
    noBookingDesc: "जब ग्राहक बुकिंग अनुरोध भेजेंगे, वे यहां दिखेंगे।",
    markDone: "पूर्ण करें", accept: "स्वीकार करें", decline: "अस्वीकार",
    markComplete: "पूर्ण चिह्नित करें", markCompleteConfirm: "क्या इस काम को पूर्ण करें?",
    declineBooking: "बुकिंग अस्वीकार करें",
    declineBookingConfirm: "क्या आप यह अनुरोध अस्वीकार करना चाहते हैं?",
    service: "सेवा", date: "तारीख", time: "समय", budget: "बजट",
  },

  Kannada: {
    account: "ಖಾತೆ", support: "ಸಹಾಯ", editProfile: "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ",
    myLocation: "ನನ್ನ ಸ್ಥಳ", language: "ಭಾಷೆ", helpCenter: "ಸಹಾಯ ಕೇಂದ್ರ",
    termsOfService: "ಸೇವಾ ನಿಯಮಗಳು", privacyPolicy: "ಗೌಪ್ಯತಾ ನೀತಿ", signOut: "ಸೈನ್ ಔಟ್",
    youreOnline: "ನೀವು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ", youreOffline: "ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ",
    customersCanFind: "ಗ್ರಾಹಕರು ನಿಮ್ಮನ್ನು ಹುಡುಕಬಹುದು",
    wontReceiveBookings: "ನೀವು ಹೊಸ ಬುಕಿಂಗ್ ಪಡೆಯುವುದಿಲ್ಲ",
    registerAsProvider: "ಪ್ರೊವೈಡರ್ ಆಗಿ ನೋಂದಣಿ ಮಾಡಿ",
    earnMoneyWithSkills: "ನಿಮ್ಮ ಕೌಶಲ್ಯದಿಂದ ಗಳಿಸಿ",
    inviteFriends: "ಸ್ನೇಹಿತರನ್ನು ಆಹ್ವಾನಿಸಿ",
    shareWithFriendsFamily: "ಸ್ನೇಹಿತರು ಮತ್ತು ಕುಟುಂಬದೊಂದಿಗೆ SkillAd ಹಂಚಿಕೊಳ್ಳಿ",
    verifiedProvider: "ಪರಿಶೀಲಿಸಿದ ಪ್ರೊವೈಡರ್", selectCity: "ನಿಮ್ಮ ನಗರ ಆಯ್ಕೆ ಮಾಡಿ",
    selectLanguage: "ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ", signOutTitle: "ಸೈನ್ ಔಟ್",
    signOutMessage: "ನೀವು ಸೈನ್ ಔಟ್ ಮಾಡಲು ಬಯಸುತ್ತೀರಾ?", signOutConfirm: "ಸೈನ್ ಔಟ್", cancel: "ರದ್ದುಮಾಡಿ",
    hi: "ನಮಸ್ಕಾರ,", detectingLocation: "ಸ್ಥಳ ಪತ್ತೆ ಮಾಡಲಾಗುತ್ತಿದೆ...", categories: "ವಿಭಾಗಗಳು",
    nearbySkilled: "ಹತ್ತಿರದ ಕುಶಲ ಕೆಲಸಗಾರರು", viewAll: "ಎಲ್ಲ ನೋಡಿ",
    noProvidersFound: "ಯಾವ ಪ್ರೊವೈಡರ್ ಸಿಗಲಿಲ್ಲ", offerSkills: "ಕೌಶಲ್ಯ ನೀಡಿ",
    searchPlaceholder: "ಕೌಶಲ್ಯ ಅಥವಾ ಸೇವೆ ಹುಡುಕಿ...",
    searchSkills: "ಕೌಶಲ್ಯ, ಸೇವೆಗಳು ಹುಡುಕಿ...", availableNow: "ಈಗ ಲಭ್ಯ",
    nearest: "ಅತ್ಯಂತ ಹತ್ತಿರ", topRated: "ಅಗ್ರ ರೇಟಿಂಗ್", mostReviews: "ಹೆಚ್ಚು ಸಮೀಕ್ಷೆ",
    within: "ಒಳಗೆ", noProvidersMatch: "ಯಾವ ಪ್ರೊವೈಡರ್ ಫಿಲ್ಟರ್‌ ಜೊತೆ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ",
    tryAdjustingFilters: "ನಿಮ್ಮ ಹುಡುಕಾಟ ಅಥವಾ ಫಿಲ್ಟರ್ ಬದಲಿಸಿ", providersFound: "ಪ್ರೊವೈಡರ್‌ಗಳು ಸಿಕ್ಕಿದ್ದಾರೆ",
    messages: "ಸಂದೇಶಗಳು", noMessagesYet: "ಇನ್ನೂ ಸಂದೇಶಗಳಿಲ್ಲ",
    noMessagesDesc: "ಕುಶಲ ಪ್ರೊವೈಡರ್ ಹುಡುಕಿ ಮತ್ತು ಮಾತನಾಡಿ.",
    findProviders: "ಪ್ರೊವೈಡರ್ ಹುಡುಕಿ", message: "ಸಂದೇಶ",
    notifications: "ಅಧಿಸೂಚನೆಗಳು", unread: "ಓದಿಲ್ಲ", markAllRead: "ಎಲ್ಲ ಓದಿದ ಎಂದು ಗುರುತಿಸಿ",
    pushNotifActive: "ಪುಶ್ ಅಧಿಸೂಚನೆಗಳು ಸಕ್ರಿಯ — ಬುಕಿಂಗ್ ಎಚ್ಚರಿಕೆ ತಕ್ಷಣ ಬರುತ್ತದೆ",
    noNotificationsYet: "ಇನ್ನೂ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ",
    notifDesc: "ಗ್ರಾಹಕರು ಬುಕಿಂಗ್ ವಿನಂತಿ ಕಳುಹಿಸಿದಾಗ ನಿಮಗೆ ತಿಳಿಸಲಾಗುತ್ತದೆ.",
    justNow: "ಈಗ ತಾನೆ",
    dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", becomeProvider: "ಪ್ರೊವೈಡರ್ ಆಗಿ",
    becomeProviderDesc: "ನಿಮ್ಮ ಕೌಶಲ್ಯ ನೋಂದಾಯಿಸಿ ಮತ್ತು ಹತ್ತಿರದ ಗ್ರಾಹಕರಿಂದ ಬುಕಿಂಗ್ ಪಡೆಯಿರಿ.",
    quickActions: "ತ್ವರಿತ ಕ್ರಿಯೆಗಳು", earnings: "ಗಳಿಕೆ", myListing: "ನನ್ನ ಪಟ್ಟಿ",
    reviews: "ಸಮೀಕ್ಷೆಗಳು", share: "ಹಂಚಿಕೊಳ್ಳಿ", bookingRequests: "ಬುಕಿಂಗ್ ವಿನಂತಿಗಳು",
    newLabel: "ಹೊಸ", pending: "ಬಾಕಿ", active: "ಸಕ್ರಿಯ", done: "ಮುಗಿದಿದೆ",
    ratingLabel: "ರೇಟಿಂಗ್", availableForJobs: "ಕೆಲಸಕ್ಕೆ ಲಭ್ಯ",
    notAvailable: "ಲಭ್ಯವಿಲ್ಲ", online: "ಆನ್‌ಲೈನ್", offline: "ಆಫ್‌ಲೈನ್",
    estimatedEarnings: "ಅಂದಾಜು ಗಳಿಕೆ", fromCompletedJobs: "ಮುಗಿದ ಕೆಲಸಗಳಿಂದ",
    noBookingRequests: "ಇನ್ನೂ ಬುಕಿಂಗ್ ವಿನಂತಿಗಳಿಲ್ಲ",
    noBookingDesc: "ಗ್ರಾಹಕರು ಬುಕಿಂಗ್ ವಿನಂತಿ ಕಳುಹಿಸಿದಾಗ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
    markDone: "ಮುಗಿಯಿತು", accept: "ಒಪ್ಪಿಕೊಳ್ಳಿ", decline: "ತಿರಸ್ಕರಿಸಿ",
    markComplete: "ಪೂರ್ಣ ಗುರುತಿಸಿ", markCompleteConfirm: "ಈ ಕೆಲಸ ಮುಗಿಸಿ?",
    declineBooking: "ಬುಕಿಂಗ್ ತಿರಸ್ಕರಿಸಿ",
    declineBookingConfirm: "ನೀವು ಈ ವಿನಂತಿ ತಿರಸ್ಕರಿಸಲು ಬಯಸುತ್ತೀರಾ?",
    service: "ಸೇವೆ", date: "ದಿನಾಂಕ", time: "ಸಮಯ", budget: "ಬಜೆಟ್",
  },

  Kashmiri: {
    account: "खाता", support: "मदद", editProfile: "प्रोफ़ाइल तरमीम करो",
    myLocation: "म्यानि जाय", language: "ज़बान", helpCenter: "मदद मरकज़",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", signOut: "साइन आउट",
    youreOnline: "तुहें ऑनलाइन छि", youreOffline: "तुहें ऑफलाइन छि",
    customersCanFind: "ग्राहक तुहें लभिथ हॆकि", wontReceiveBookings: "तुहें नव बुकिंग न लभिथ",
    registerAsProvider: "प्रदाता हिसाबस रजिस्टर करो",
    earnMoneyWithSkills: "हुनर सेटी कमाओ",
    inviteFriends: "दोस्तन ज़ुह आमंत्रण",
    shareWithFriendsFamily: "दोस्त ते खानदानस पेठ SkillAd शेयर करो",
    verifiedProvider: "Verified Provider", selectCity: "अपनि शहर छानिव",
    selectLanguage: "ज़बान छानिव", signOutTitle: "साइन आउट",
    signOutMessage: "क्या तुहें साइन आउट करने छि?", signOutConfirm: "साइन आउट", cancel: "रद्द करो",
    hi: "नमस्ते,", detectingLocation: "जाय लब्बान...", categories: "श्रेणी",
    nearbySkilled: "नेड़ुक हुनरमंद", viewAll: "सब दिखाओ",
    noProvidersFound: "कोई प्रदाता नहीं मिल्यो", offerSkills: "हुनर दओ",
    searchPlaceholder: "हुनर या सेवा लब्बो...",
    searchSkills: "हुनर, सेवा लब्बो...", availableNow: "अबि उपलब्ध",
    nearest: "सबसे नेड़ुक", topRated: "Top Rated", mostReviews: "Most Reviews",
    within: "अंदर", noProvidersMatch: "कोई प्रदाता फिल्टरस नहीं मिल्यो",
    tryAdjustingFilters: "फिल्टर बदलो", providersFound: "प्रदाता मिले",
    messages: "पैगाम", noMessagesYet: "कोई पैगाम नहीं",
    noMessagesDesc: "हुनरमंद लब्बो ते बातचीत शुरू करो।",
    findProviders: "प्रदाता लब्बो", message: "पैगाम",
    notifications: "इत्तला", unread: "अनपड़ी", markAllRead: "सब पड़ी",
    pushNotifActive: "Push notifications active — booking alerts immediately",
    noNotificationsYet: "कोई इत्तला नहीं",
    notifDesc: "ग्राहक बुकिंग request घल्लन तुहें जानल।",
    justNow: "अबि",
    dashboard: "Dashboard", becomeProvider: "Provider बनो",
    becomeProviderDesc: "हुनर register करो ते नेड़ुक ग्राहकेन पेठ booking पाओ।",
    quickActions: "Quick Actions", earnings: "कमाई", myListing: "म्यानि लिस्ट",
    reviews: "समीक्षा", share: "शेयर", bookingRequests: "Booking Request",
    newLabel: "नव", pending: "Pending", active: "Active", done: "Completed",
    ratingLabel: "Rating", availableForJobs: "काम बेई उपलब्ध",
    notAvailable: "उपलब्ध नहीं", online: "Online", offline: "Offline",
    estimatedEarnings: "कमाई अंदाज़", fromCompletedJobs: "मुकम्मल कामेन पेठ",
    noBookingRequests: "कोई booking request नहीं",
    noBookingDesc: "ग्राहक booking request घल्लन, यति दिखेन।",
    markDone: "मुकम्मल", accept: "मंज़ूर", decline: "रद्द",
    markComplete: "मुकम्मल करो", markCompleteConfirm: "यि काम मुकम्मल?",
    declineBooking: "Booking रद्द",
    declineBookingConfirm: "Request रद्द करना?",
    service: "सेवा", date: "तारीख", time: "वकत", budget: "Budget",
  },

  Kokborok: {
    account: "Account", support: "Swthar", editProfile: "Profile Phnai",
    myLocation: "Nwng Boro", language: "Khorang", helpCenter: "Swthar Kendra",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", signOut: "Sign Out",
    youreOnline: "Nwng Online Whai", youreOffline: "Nwng Offline Whai",
    customersCanFind: "Customer nwngbai kha thaikma", wontReceiveBookings: "Nwng booking thi phaima",
    registerAsProvider: "Provider hmabai Register", earnMoneyWithSkills: "Nwng skill diya taka kamao",
    inviteFriends: "Mohojan Invite Phnai", shareWithFriendsFamily: "Mohojanma SkillAd share phnai",
    verifiedProvider: "Verified Provider", selectCity: "Boro Select Phnai",
    selectLanguage: "Khorang Select Phnai", signOutTitle: "Sign Out",
    signOutMessage: "Sign out phnai khwma?", signOutConfirm: "Sign Out", cancel: "Na",
    hi: "Borok,", detectingLocation: "Boro khwbwi...", categories: "Wikim",
    nearbySkilled: "Aasal Skilled Worker", viewAll: "Hobnai Bai",
    noProvidersFound: "Provider thi phaima", offerSkills: "Skill Dinai",
    searchPlaceholder: "Skill baa seva khwi...",
    searchSkills: "Skill, seva khwi...", availableNow: "Awthai Available",
    nearest: "Sobseba Aasal", topRated: "Top Rated", mostReviews: "Most Reviews",
    within: "Gwdan", noProvidersMatch: "Provider filter sannai thiphaima",
    tryAdjustingFilters: "Filter badlaobai kha", providersFound: "provider thi",
    messages: "Liphi", noMessagesYet: "Liphi nanai",
    noMessagesDesc: "Provider khwi, liphi phnai.",
    findProviders: "Provider Khwi", message: "Liphi",
    notifications: "Khabor", unread: "Nphrwi", markAllRead: "Hobnai Phrwi",
    pushNotifActive: "Push notification active — booking khabor aabar pabo",
    noNotificationsYet: "Khabor nanai",
    notifDesc: "Customer booking request phathalao nwng khabor pabo.",
    justNow: "Awthai",
    dashboard: "Dashboard", becomeProvider: "Provider Habai",
    becomeProviderDesc: "Skill register phnai, aasal customer booking pabo.",
    quickActions: "Quick Actions", earnings: "Taka", myListing: "Nwng List",
    reviews: "Mwt", share: "Share", bookingRequests: "Booking Request",
    newLabel: "Nwi", pending: "Pending", active: "Active", done: "Shamai",
    ratingLabel: "Rating", availableForJobs: "Kamna Available",
    notAvailable: "Available nanai", online: "Online", offline: "Offline",
    estimatedEarnings: "Taka Khabor", fromCompletedJobs: "Shamai kamna",
    noBookingRequests: "Booking request nanai",
    noBookingDesc: "Customer booking request phathalao, aabar gonab.",
    markDone: "Shamai", accept: "Maan", decline: "Nanai",
    markComplete: "Shamai Mark", markCompleteConfirm: "Kaam shamai?",
    declineBooking: "Booking Nanai",
    declineBookingConfirm: "Request decline phnai?",
    service: "Seva", date: "Rong", time: "Samay", budget: "Budget",
  },

  Konkani: {
    account: "खातें", support: "मदत", editProfile: "प्रोफाइल बदला",
    myLocation: "माझी जागा", language: "भास", helpCenter: "मदत केंद्र",
    termsOfService: "सेवेचे नियम", privacyPolicy: "गोपनीयता धोरण", signOut: "साइन आउट",
    youreOnline: "तूं ऑनलाइन आसा", youreOffline: "तूं ऑफलाइन आसा",
    customersCanFind: "ग्राहक तुका सोदून काडटात",
    wontReceiveBookings: "तुका नव्यो बुकिंग मेळचेनात",
    registerAsProvider: "प्रोवाइडर म्हूण नोंदणी करा",
    earnMoneyWithSkills: "तुझ्या कुशलताय वरवीं कमया",
    inviteFriends: "मित्रांक आमंत्रण दिया",
    shareWithFriendsFamily: "मित्र आनी कुटुंबा कडेन SkillAd वांटा",
    verifiedProvider: "सत्यापित प्रोवाइडर", selectCity: "तुझो शहर निवड",
    selectLanguage: "भास निवड", signOutTitle: "साइन आउट",
    signOutMessage: "तुका साइन आउट करचें जाय?", signOutConfirm: "साइन आउट", cancel: "रद्द करा",
    hi: "नमस्कार,", detectingLocation: "जागा सोदतां...", categories: "विभाग",
    nearbySkilled: "लागसार कुशल कामगार", viewAll: "सगळें पळय",
    noProvidersFound: "कोणूच प्रोवाइडर मेळनात", offerSkills: "कुशलताय दिया",
    searchPlaceholder: "कुशलताय वा सेवा सोद...",
    searchSkills: "कुशलताय, सेवा सोद...", availableNow: "आतां उपलब्ध",
    nearest: "सगळ्यांत लागसार", topRated: "उच्च रेटेड", mostReviews: "सगळ्यांत चड समीक्षा",
    within: "आंत", noProvidersMatch: "फिल्टर सांगाता कोणूच प्रोवाइडर जोडना",
    tryAdjustingFilters: "सोद वा फिल्टर बदला", providersFound: "प्रोवाइडर मेळले",
    messages: "संदेश", noMessagesYet: "आयज संदेश ना",
    noMessagesDesc: "कुशल प्रोवाइडर सोद आनी गजाली सुरू करा।",
    findProviders: "प्रोवाइडर सोद", message: "संदेश",
    notifications: "सूचना", unread: "वाचूंक नाय", markAllRead: "सगळें वाचलां करा",
    pushNotifActive: "Push notifications active — booking alerts लागेच येतात",
    noNotificationsYet: "सूचना ना",
    notifDesc: "ग्राहक booking request धाडटकच तुका कळयतलो।",
    justNow: "आतां",
    dashboard: "Dashboard", becomeProvider: "Provider जा",
    becomeProviderDesc: "कुशलताय नोंद करा आनी लागसारल्या ग्राहकांकडल्यान booking मेळय।",
    quickActions: "Quick Actions", earnings: "कमाई", myListing: "माझी यादी",
    reviews: "समीक्षा", share: "वांट", bookingRequests: "Booking Request",
    newLabel: "नवो", pending: "बाकी", active: "सक्रिय", done: "जालां",
    ratingLabel: "Rating", availableForJobs: "काम लेगीं उपलब्ध",
    notAvailable: "उपलब्ध ना", online: "Online", offline: "Offline",
    estimatedEarnings: "अंदाज कमाई", fromCompletedJobs: "जाल्ल्या कामांवयल्यान",
    noBookingRequests: "Booking request ना",
    noBookingDesc: "ग्राहक booking request धाडटकच, हांगा दिसतलें।",
    markDone: "जालां करा", accept: "मान्य", decline: "नाकारा",
    markComplete: "पूर्ण करा", markCompleteConfirm: "हें काम पूर्ण?",
    declineBooking: "Booking नाकारा",
    declineBookingConfirm: "Request नाकारचें?",
    service: "सेवा", date: "तारीख", time: "वेळ", budget: "Budget",
  },

  Maithili: {
    account: "खाता", support: "सहायता", editProfile: "प्रोफाइल बदलू",
    myLocation: "हमर स्थान", language: "भाषा", helpCenter: "सहायता केंद्र",
    termsOfService: "सेवाक शर्त", privacyPolicy: "गोपनीयता नीति", signOut: "साइन आउट",
    youreOnline: "अहाँ ऑनलाइन छी", youreOffline: "अहाँ ऑफलाइन छी",
    customersCanFind: "ग्राहक अहाँ के भेट सकैत छथि",
    wontReceiveBookings: "अहाँ के नव बुकिंग नहि भेटत",
    registerAsProvider: "प्रदाता के रूप में पंजीकरण करू",
    earnMoneyWithSkills: "अपन कौशल सं कमाऊ",
    inviteFriends: "मित्र के आमंत्रण दिअ",
    shareWithFriendsFamily: "मित्र आ परिवार संग SkillAd शेयर करू",
    verifiedProvider: "सत्यापित प्रदाता", selectCity: "अपन शहर चुनू",
    selectLanguage: "भाषा चुनू", signOutTitle: "साइन आउट",
    signOutMessage: "की अहाँ साइन आउट करय चाहैत छी?", signOutConfirm: "साइन आउट", cancel: "रद्द करू",
    hi: "नमस्ते,", detectingLocation: "स्थान खोजल जा रहल अछि...", categories: "श्रेणी",
    nearbySkilled: "नजदीकक कुशल कारीगर", viewAll: "सभ देखू",
    noProvidersFound: "कोनो प्रदाता नहि भेटल", offerSkills: "हुनर दिअ",
    searchPlaceholder: "हुनर या सेवा खोजू...",
    searchSkills: "हुनर, सेवा खोजू...", availableNow: "अखन उपलब्ध",
    nearest: "सबसे नजदीक", topRated: "शीर्ष रेटेड", mostReviews: "सर्वाधिक समीक्षा",
    within: "अंदर", noProvidersMatch: "कोनो प्रदाता फिल्टर संग मेल नहि खाइत",
    tryAdjustingFilters: "खोज या फिल्टर बदलू", providersFound: "प्रदाता भेटल",
    messages: "संदेश", noMessagesYet: "अखन कोनो संदेश नहि",
    noMessagesDesc: "कुशल प्रदाता खोजू आ बातचीत शुरू करू।",
    findProviders: "प्रदाता खोजू", message: "संदेश",
    notifications: "सूचना", unread: "अनपढ़", markAllRead: "सभ पढ़ल करू",
    pushNotifActive: "Push notification सक्रिय — booking alert तुरंत आयत",
    noNotificationsYet: "अखन कोनो सूचना नहि",
    notifDesc: "ग्राहक booking अनुरोध पठओताह, अहाँ के बताओल जायत।",
    justNow: "अखने",
    dashboard: "Dashboard", becomeProvider: "प्रदाता बनू",
    becomeProviderDesc: "कौशल पंजीकृत करू आ नजदीकक ग्राहक सं booking पाऊ।",
    quickActions: "Quick Actions", earnings: "कमाई", myListing: "हमर सूची",
    reviews: "समीक्षा", share: "साझा", bookingRequests: "Booking Request",
    newLabel: "नव", pending: "बाकी", active: "सक्रिय", done: "पूर्ण",
    ratingLabel: "Rating", availableForJobs: "काज लेल उपलब्ध",
    notAvailable: "उपलब्ध नहि", online: "Online", offline: "Offline",
    estimatedEarnings: "अनुमानित कमाई", fromCompletedJobs: "पूर्ण कार्य सं",
    noBookingRequests: "अखन कोनो booking अनुरोध नहि",
    noBookingDesc: "ग्राहक booking अनुरोध पठओताह, ऐठाम देखाइत।",
    markDone: "पूर्ण करू", accept: "स्वीकार", decline: "अस्वीकार",
    markComplete: "पूर्ण चिह्नित करू", markCompleteConfirm: "ई काज पूर्ण करू?",
    declineBooking: "Booking अस्वीकार",
    declineBookingConfirm: "की अहाँ इ अनुरोध अस्वीकार करय चाहैत छी?",
    service: "सेवा", date: "तारीख", time: "समय", budget: "Budget",
  },

  Malayalam: {
    account: "അക്കൗണ്ട്", support: "സഹായം", editProfile: "പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക",
    myLocation: "എന്റെ സ്ഥാനം", language: "ഭാഷ", helpCenter: "സഹായ കേന്ദ്രം",
    termsOfService: "സേവന നിബന്ധനകൾ", privacyPolicy: "സ്വകാര്യതാ നയം", signOut: "സൈൻ ഔട്ട്",
    youreOnline: "നിങ്ങൾ ഓൺലൈനിൽ ആണ്", youreOffline: "നിങ്ങൾ ഓഫ്‌ലൈനിൽ ആണ്",
    customersCanFind: "ഉപഭോക്താക്കൾക്ക് നിങ്ങളെ കണ്ടെത്താം",
    wontReceiveBookings: "നിങ്ങൾക്ക് പുതിയ ബുക്കിംഗ് ലഭിക്കില്ല",
    registerAsProvider: "സേവന ദാതാവായി രജിസ്റ്റർ ചെയ്യുക",
    earnMoneyWithSkills: "നിങ്ങളുടെ കഴിവ് ഉപയോഗിച്ച് സമ്പാദിക്കുക",
    inviteFriends: "സുഹൃത്തുക്കളെ ക്ഷണിക്കുക",
    shareWithFriendsFamily: "സുഹൃത്തുക്കളും കുടുംബവുമായി SkillAd പങ്കിടുക",
    verifiedProvider: "സ്ഥിരീകരിച്ച ദാതാവ്", selectCity: "നിങ്ങളുടെ നഗരം തിരഞ്ഞെടുക്കുക",
    selectLanguage: "ഭാഷ തിരഞ്ഞെടുക്കുക", signOutTitle: "സൈൻ ഔട്ട്",
    signOutMessage: "നിങ്ങൾ സൈൻ ഔട്ട് ചെയ്യാൻ ആഗ്രഹിക്കുന്നുണ്ടോ?", signOutConfirm: "സൈൻ ഔട്ട്", cancel: "റദ്ദാക്കുക",
    hi: "നമസ്കാരം,", detectingLocation: "സ്ഥാനം കണ്ടെത്തുന്നു...", categories: "വിഭാഗങ്ങൾ",
    nearbySkilled: "അടുത്തുള്ള കഴിവുള്ളവർ", viewAll: "എല്ലാം കാണുക",
    noProvidersFound: "ദാതാക്കളെ കണ്ടെത്തിയില്ല", offerSkills: "കഴിവ് നൽകുക",
    searchPlaceholder: "കഴിവ് അല്ലെങ്കിൽ സേവനം തിരയുക...",
    searchSkills: "കഴിവ്, സേവനങ്ങൾ തിരയുക...", availableNow: "ഇപ്പോൾ ലഭ്യം",
    nearest: "ഏറ്റവും അടുത്ത്", topRated: "ഉയർന്ന റേറ്റിംഗ്", mostReviews: "ഏറ്റവും അഭിപ്രായം",
    within: "ഉള്ളിൽ", noProvidersMatch: "ഫിൽട്ടറുമായി ഒരു ദാതാവും പൊരുത്തപ്പെടുന്നില്ല",
    tryAdjustingFilters: "നിങ്ങളുടെ തിരയൽ അല്ലെങ്കിൽ ഫിൽട്ടർ മാറ്റുക", providersFound: "ദാതാക്കൾ കണ്ടെത്തി",
    messages: "സന്ദേശങ്ങൾ", noMessagesYet: "ഇതുവരെ സന്ദേശങ്ങളില്ല",
    noMessagesDesc: "ഒരു കഴിവുള്ള ദാതാവിനെ കണ്ടെത്തി സംഭാഷണം ആരംഭിക്കുക.",
    findProviders: "ദാതാക്കളെ കണ്ടെത്തുക", message: "സന്ദേശം",
    notifications: "അറിയിപ്പുകൾ", unread: "വായിക്കാത്ത", markAllRead: "എല്ലാം വായിച്ചതായി",
    pushNotifActive: "പുഷ് അറിയിപ്പുകൾ സക്രിയം — ബുക്കിംഗ് അലേർട്ട് ഉടൻ ലഭിക്കും",
    noNotificationsYet: "ഇതുവരെ അറിയിപ്പുകളില്ല",
    notifDesc: "ഉപഭോക്താക്കൾ ബുക്കിംഗ് അഭ്യർഥനകൾ അയക്കുമ്പോൾ നിങ്ങൾക്ക് അറിയിപ്പ് ലഭിക്കും.",
    justNow: "ഇപ്പോൾ",
    dashboard: "ഡാഷ്ബോർഡ്", becomeProvider: "ദാതാവ് ആകുക",
    becomeProviderDesc: "നിങ്ങളുടെ കഴിവ് രജിസ്റ്റർ ചെയ്ത് അടുത്തുള്ള ഉപഭോക്താക്കളിൽ നിന്ന് ബുക്കിംഗ് ലഭിക്കുക.",
    quickActions: "ദ്രുത പ്രവർത്തനങ്ങൾ", earnings: "വരുമാനം", myListing: "എന്റെ ലിസ്റ്റ്",
    reviews: "അഭിപ്രായങ്ങൾ", share: "പങ്കിടുക", bookingRequests: "ബുക്കിംഗ് അഭ്യർഥനകൾ",
    newLabel: "പുതിയ", pending: "കാത്തിരിക്കുന്ന", active: "സജീവം", done: "പൂർത്തിയായി",
    ratingLabel: "റേറ്റിംഗ്", availableForJobs: "ജോലിക്ക് ലഭ്യം",
    notAvailable: "ലഭ്യമല്ല", online: "ഓൺലൈൻ", offline: "ഓഫ്‌ലൈൻ",
    estimatedEarnings: "ഏകദേശ വരുമാനം", fromCompletedJobs: "പൂർത്തിയായ ജോലികളിൽ നിന്ന്",
    noBookingRequests: "ഇതുവരെ ബുക്കിംഗ് അഭ്യർഥനകളില്ല",
    noBookingDesc: "ഉപഭോക്താക്കൾ ബുക്കിംഗ് അഭ്യർഥനകൾ അയക്കുമ്പോൾ ഇവിടെ കാണും.",
    markDone: "പൂർത്തിയായി", accept: "സ്വീകരിക്കുക", decline: "നിരസിക്കുക",
    markComplete: "പൂർത്തി ചിഹ്നിക്കുക", markCompleteConfirm: "ഈ ജോലി പൂർത്തിയായോ?",
    declineBooking: "ബുക്കിംഗ് നിരസിക്കുക",
    declineBookingConfirm: "നിങ്ങൾ ഈ അഭ്യർഥന നിരസിക്കാൻ ആഗ്രഹിക്കുന്നുണ്ടോ?",
    service: "സേവനം", date: "തീയതി", time: "സമയം", budget: "ബജറ്റ്",
  },

  Manipuri: {
    account: "একাউন্ট", support: "সহায়তা", editProfile: "প্রোফাইল বদলউ",
    myLocation: "ঙাগী থৌদাং", language: "লোন", helpCenter: "সহায়তা কেন্দ্র",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", signOut: "Sign Out",
    youreOnline: "নংনা Online দা লৈঙৈ", youreOffline: "নংনা Offline দা লৈঙৈ",
    customersCanFind: "Customer শিংনা নংবু থম্বীরমগনি",
    wontReceiveBookings: "নং অমুক Booking থম্বীরমগে",
    registerAsProvider: "Provider নিংথিজনবা Register তৌ",
    earnMoneyWithSkills: "নংগী Skill দগী খরা হন্না",
    inviteFriends: "মিত্রশিং Invite তৌ",
    shareWithFriendsFamily: "মিত্র অমদি পুম্নমক SkillAd শেয়ার তৌ",
    verifiedProvider: "Verified Provider", selectCity: "নংগী শহর শেম্মিন",
    selectLanguage: "লোন শেম্মিন", signOutTitle: "Sign Out",
    signOutMessage: "নং Sign Out তৌবা খঙদবনো?", signOutConfirm: "Sign Out", cancel: "চিংথরক",
    hi: "হায়,", detectingLocation: "থৌদাং লৌচিন্নবা...", categories: "Category শিং",
    nearbySkilled: "মখল মখল Skilled Worker শিং", viewAll: "পুম্নমক উৎ",
    noProvidersFound: "Provider অমত্তা থম্বীরমগে", offerSkills: "Skill পিবিয়ু",
    searchPlaceholder: "Skill বা সেবা থাজিন্নবিয়ু...",
    searchSkills: "Skill, সেবা থাজিন্নবিয়ু...", availableNow: "অদুগা Available",
    nearest: "মখলগীদমক", topRated: "Top Rated", mostReviews: "Most Reviews",
    within: "অমক্তা", noProvidersMatch: "Filter দা Provider অমত্তা মিলমগে",
    tryAdjustingFilters: "Filter বদল তৌবিয়ু", providersFound: "provider থম্বীরমে",
    messages: "Message শিং", noMessagesYet: "Message অমত্তা অমুক নত্তে",
    noMessagesDesc: "Skilled Provider থাজিন্নিনু অমদি লাইরিক পাংথোক্কিনু।",
    findProviders: "Provider থাজিন্নবিয়ু", message: "Message",
    notifications: "Notification শিং", unread: "নপ্রিল্লমবা", markAllRead: "পুম্নমক প্রিল্লমবা",
    pushNotifActive: "Push notifications active — booking alerts তুরন্তে থম্বীরমে",
    noNotificationsYet: "Notification অমত্তা অমুক নত্তে",
    notifDesc: "Customer শিংনা booking request থকচবদা নংবু খঙহল্লগনি।",
    justNow: "অদুগা",
    dashboard: "Dashboard", becomeProvider: "Provider হনু",
    becomeProviderDesc: "Skill register তৌনু অমদি মখল মখলদগী booking থম্বিরু।",
    quickActions: "Quick Actions", earnings: "খরা", myListing: "ঙাগী List",
    reviews: "Review শিং", share: "Share", bookingRequests: "Booking Request শিং",
    newLabel: "অমুক", pending: "Pending", active: "Active", done: "শেমগৎলে",
    ratingLabel: "Rating", availableForJobs: "কাজ তৌবা Available",
    notAvailable: "Available নত্তে", online: "Online", offline: "Offline",
    estimatedEarnings: "খরাগী অন্দাজ", fromCompletedJobs: "শেমগৎলবা কাজশিংদগী",
    noBookingRequests: "Booking request অমত্তা অমুক নত্তে",
    noBookingDesc: "Customer শিংনা booking request থকচবদা অতেীদা উৎপাংলগনি।",
    markDone: "শেমগৎ", accept: "মান্নিনু", decline: "চিংথরক",
    markComplete: "পূর্ণ করু", markCompleteConfirm: "কাজ অদু শেমগৎপনো?",
    declineBooking: "Booking চিংথরক",
    declineBookingConfirm: "Request অদু চিংথরক তৌবা খঙদবনো?",
    service: "সেবা", date: "নুমিৎ", time: "মতম", budget: "Budget",
  },

  Marathi: {
    account: "खाते", support: "मदत", editProfile: "प्रोफाइल संपादित करा",
    myLocation: "माझे स्थान", language: "भाषा", helpCenter: "मदत केंद्र",
    termsOfService: "सेवा अटी", privacyPolicy: "गोपनीयता धोरण", signOut: "साइन आउट",
    youreOnline: "तुम्ही ऑनलाइन आहात", youreOffline: "तुम्ही ऑफलाइन आहात",
    customersCanFind: "ग्राहक तुम्हाला शोधू शकतात",
    wontReceiveBookings: "तुम्हाला नवीन बुकिंग मिळणार नाही",
    registerAsProvider: "प्रदाता म्हणून नोंदणी करा",
    earnMoneyWithSkills: "तुमच्या कौशल्याने कमवा",
    inviteFriends: "मित्रांना आमंत्रित करा",
    shareWithFriendsFamily: "मित्र आणि कुटुंबासह SkillAd शेअर करा",
    verifiedProvider: "सत्यापित प्रदाता", selectCity: "तुमचे शहर निवडा",
    selectLanguage: "भाषा निवडा", signOutTitle: "साइन आउट",
    signOutMessage: "तुम्हाला साइन आउट करायचे आहे का?", signOutConfirm: "साइन आउट", cancel: "रद्द करा",
    hi: "नमस्कार,", detectingLocation: "स्थान शोधत आहे...", categories: "श्रेणी",
    nearbySkilled: "जवळचे कुशल कामगार", viewAll: "सर्व पहा",
    noProvidersFound: "कोणताही प्रदाता सापडला नाही", offerSkills: "कौशल्य द्या",
    searchPlaceholder: "कौशल्य किंवा सेवा शोधा...",
    searchSkills: "कौशल्य, सेवा शोधा...", availableNow: "आता उपलब्ध",
    nearest: "सर्वात जवळ", topRated: "शीर्ष रेटेड", mostReviews: "सर्वाधिक समीक्षा",
    within: "आत", noProvidersMatch: "कोणताही प्रदाता फिल्टरशी जुळत नाही",
    tryAdjustingFilters: "तुमचा शोध किंवा फिल्टर बदला", providersFound: "प्रदाता सापडले",
    messages: "संदेश", noMessagesYet: "अद्याप कोणताही संदेश नाही",
    noMessagesDesc: "कुशल प्रदाता शोधा आणि संभाषण सुरू करा.",
    findProviders: "प्रदाता शोधा", message: "संदेश",
    notifications: "सूचना", unread: "न वाचलेले", markAllRead: "सर्व वाचले म्हणून चिन्हांकित करा",
    pushNotifActive: "पुश सूचना सक्रिय — बुकिंग अलर्ट लगेच मिळतो",
    noNotificationsYet: "अद्याप कोणतीही सूचना नाही",
    notifDesc: "ग्राहक बुकिंग विनंती पाठवतील तेव्हा तुम्हाला सूचित केले जाईल.",
    justNow: "आत्ता",
    dashboard: "डॅशबोर्ड", becomeProvider: "प्रदाता व्हा",
    becomeProviderDesc: "तुमचे कौशल्य नोंदवा आणि जवळच्या ग्राहकांकडून बुकिंग मिळवा.",
    quickActions: "त्वरित क्रिया", earnings: "कमाई", myListing: "माझी यादी",
    reviews: "समीक्षा", share: "शेअर करा", bookingRequests: "बुकिंग विनंत्या",
    newLabel: "नवीन", pending: "प्रतीक्षा", active: "सक्रिय", done: "पूर्ण",
    ratingLabel: "रेटिंग", availableForJobs: "कामासाठी उपलब्ध",
    notAvailable: "उपलब्ध नाही", online: "ऑनलाइन", offline: "ऑफलाइन",
    estimatedEarnings: "अंदाजित कमाई", fromCompletedJobs: "पूर्ण कामांमधून",
    noBookingRequests: "अद्याप कोणतीही बुकिंग विनंती नाही",
    noBookingDesc: "ग्राहक बुकिंग विनंती पाठवतील तेव्हा येथे दिसेल.",
    markDone: "पूर्ण करा", accept: "स्वीकारा", decline: "नाकारा",
    markComplete: "पूर्ण चिन्हांकित करा", markCompleteConfirm: "हे काम पूर्ण करायचे?",
    declineBooking: "बुकिंग नाकारा",
    declineBookingConfirm: "तुम्हाला ही विनंती नाकारायची आहे का?",
    service: "सेवा", date: "तारीख", time: "वेळ", budget: "बजेट",
  },

  Nepali: {
    account: "खाता", support: "सहायता", editProfile: "प्रोफाइल सम्पादन गर्नुहोस्",
    myLocation: "मेरो स्थान", language: "भाषा", helpCenter: "सहायता केन्द्र",
    termsOfService: "सेवाका सर्तहरू", privacyPolicy: "गोपनीयता नीति", signOut: "साइन आउट",
    youreOnline: "तपाईं अनलाइन हुनुहुन्छ", youreOffline: "तपाईं अफलाइन हुनुहुन्छ",
    customersCanFind: "ग्राहकहरूले तपाईंलाई भेट्टाउन सक्छन्",
    wontReceiveBookings: "तपाईंले नयाँ बुकिङ पाउनुहुनेछैन",
    registerAsProvider: "प्रदायकको रूपमा दर्ता गर्नुहोस्",
    earnMoneyWithSkills: "आफ्नो सीपले कमाउनुहोस्",
    inviteFriends: "साथीहरूलाई आमन्त्रण दिनुहोस्",
    shareWithFriendsFamily: "साथी र परिवारसँग SkillAd साझा गर्नुहोस्",
    verifiedProvider: "प्रमाणित प्रदायक", selectCity: "आफ्नो शहर छान्नुहोस्",
    selectLanguage: "भाषा छान्नुहोस्", signOutTitle: "साइन आउट",
    signOutMessage: "के तपाईं साइन आउट गर्न चाहनुहुन्छ?", signOutConfirm: "साइन आउट", cancel: "रद्द गर्नुहोस्",
    hi: "नमस्ते,", detectingLocation: "स्थान पत्ता लगाउँदै...", categories: "श्रेणीहरू",
    nearbySkilled: "नजिकका दक्ष कामदारहरू", viewAll: "सबै हेर्नुहोस्",
    noProvidersFound: "कुनै प्रदायक भेटिएन", offerSkills: "सीप दिनुहोस्",
    searchPlaceholder: "सीप वा सेवा खोज्नुहोस्...",
    searchSkills: "सीप, सेवाहरू खोज्नुहोस्...", availableNow: "अहिले उपलब्ध",
    nearest: "सबैभन्दा नजिक", topRated: "शीर्ष मूल्याङ्कन", mostReviews: "सर्वाधिक समीक्षा",
    within: "भित्र", noProvidersMatch: "कुनै प्रदायक फिल्टरसँग मेल खाँदैन",
    tryAdjustingFilters: "आफ्नो खोज वा फिल्टर परिवर्तन गर्नुहोस्", providersFound: "प्रदायकहरू भेटिए",
    messages: "सन्देशहरू", noMessagesYet: "अहिलेसम्म कुनै सन्देश छैन",
    noMessagesDesc: "दक्ष प्रदायक खोज्नुहोस् र कुराकानी सुरु गर्नुहोस्।",
    findProviders: "प्रदायक खोज्नुहोस्", message: "सन्देश",
    notifications: "सूचनाहरू", unread: "नपढेको", markAllRead: "सबै पढेको गर्नुहोस्",
    pushNotifActive: "पुश सूचनाहरू सक्रिय — बुकिङ अलर्ट तुरुन्त आउँछ",
    noNotificationsYet: "अहिलेसम्म कुनै सूचना छैन",
    notifDesc: "ग्राहकहरूले बुकिङ अनुरोध पठाउँदा तपाईंलाई सूचित गरिनेछ।",
    justNow: "अहिले",
    dashboard: "ड्यासबोर्ड", becomeProvider: "प्रदायक बन्नुहोस्",
    becomeProviderDesc: "आफ्नो सीप दर्ता गर्नुहोस् र नजिकका ग्राहकहरूबाट बुकिङ पाउनुहोस्।",
    quickActions: "द्रुत कार्यहरू", earnings: "आम्दानी", myListing: "मेरो सूची",
    reviews: "समीक्षाहरू", share: "साझा गर्नुहोस्", bookingRequests: "बुकिङ अनुरोधहरू",
    newLabel: "नयाँ", pending: "बाँकी", active: "सक्रिय", done: "सम्पन्न",
    ratingLabel: "मूल्याङ्कन", availableForJobs: "कामको लागि उपलब्ध",
    notAvailable: "उपलब्ध छैन", online: "अनलाइन", offline: "अफलाइन",
    estimatedEarnings: "अनुमानित आम्दानी", fromCompletedJobs: "सम्पन्न कामहरूबाट",
    noBookingRequests: "अहिलेसम्म कुनै बुकिङ अनुरोध छैन",
    noBookingDesc: "ग्राहकहरूले बुकिङ अनुरोध पठाउँदा यहाँ देखिनेछ।",
    markDone: "सम्पन्न गर्नुहोस्", accept: "स्वीकार गर्नुहोस्", decline: "अस्वीकार",
    markComplete: "सम्पन्न चिह्नित गर्नुहोस्", markCompleteConfirm: "यो काम सम्पन्न गर्ने?",
    declineBooking: "बुकिङ अस्वीकार",
    declineBookingConfirm: "के तपाईं यो अनुरोध अस्वीकार गर्न चाहनुहुन्छ?",
    service: "सेवा", date: "मिति", time: "समय", budget: "बजेट",
  },

  Odia: {
    account: "ଖାତା", support: "ସହାୟ", editProfile: "ପ୍ରୋଫାଇଲ ସଂପାଦନ କରନ୍ତୁ",
    myLocation: "ମୋ ସ୍ଥାନ", language: "ଭାଷା", helpCenter: "ସହାୟ କେନ୍ଦ୍ର",
    termsOfService: "ସେବା ସର୍ତ", privacyPolicy: "ଗୋପନୀୟତା ନୀତି", signOut: "ସାଇନ ଆଉଟ",
    youreOnline: "ଆପଣ ଅନ୍‌ଲାଇନ ଅଛନ୍ତି", youreOffline: "ଆପଣ ଅଫ୍‌ଲାଇନ ଅଛନ୍ତି",
    customersCanFind: "ଗ୍ରାହକ ଆପଣଙ୍କୁ ଖୋଜି ପାରିବେ",
    wontReceiveBookings: "ଆପଣ ନୂଆ ବୁକିଙ୍ଗ ପାଇବେ ନାହିଁ",
    registerAsProvider: "ସେବା ପ୍ରଦାୟକ ହିସାବରେ ପଞ୍ଜିକରଣ",
    earnMoneyWithSkills: "ଆପଣଙ୍କ ଦକ୍ଷତା ଦ୍ୱାରା ଉପାର୍ଜନ କରନ୍ତୁ",
    inviteFriends: "ବନ୍ଧୁଙ୍କୁ ଆମନ୍ତ୍ରଣ କରନ୍ତୁ",
    shareWithFriendsFamily: "ବନ୍ଧୁ ଓ ପରିବାର ସହ SkillAd ଅଂଶୀଦାର",
    verifiedProvider: "ଯାଚାଇ କରା ପ୍ରଦାୟକ", selectCity: "ଆପଣଙ୍କ ସହର ବାଛନ୍ତୁ",
    selectLanguage: "ଭାଷା ବାଛନ୍ତୁ", signOutTitle: "ସାଇନ ଆଉଟ",
    signOutMessage: "ଆପଣ ସାଇନ ଆଉଟ କରିବାକୁ ଚାହୁଁଛନ୍ତି କି?", signOutConfirm: "ସାଇନ ଆଉଟ", cancel: "ବାତିଲ",
    hi: "ନମସ୍କାର,", detectingLocation: "ସ୍ଥାନ ଖୋଜୁଛୁ...", categories: "ବିଭାଗ",
    nearbySkilled: "ନିକଟ ଦକ୍ଷ କର୍ମୀ", viewAll: "ସବୁ ଦେଖନ୍ତୁ",
    noProvidersFound: "କୌଣସି ପ୍ରଦାୟକ ମିଳିଲ ନାହିଁ", offerSkills: "ଦକ୍ଷତା ଦିଅ",
    searchPlaceholder: "ଦକ୍ଷତା ବା ସେବା ଖୋଜନ୍ତୁ...",
    searchSkills: "ଦକ୍ଷତା, ସେବା ଖୋଜନ୍ତୁ...", availableNow: "ଏବେ ଉପଲବ୍ଧ",
    nearest: "ସବୁଠୁ ନିକଟ", topRated: "ଶୀର୍ଷ ରେଟ", mostReviews: "ସର୍ବାଧିକ ସମୀକ୍ଷା",
    within: "ଭିତରେ", noProvidersMatch: "ଫିଲ୍ଟର ସହ କୌଣସି ପ୍ରଦାୟକ ମେଳ ଖାଉ ନାହିଁ",
    tryAdjustingFilters: "ଆପଣଙ୍କ ଖୋଜ ବା ଫିଲ୍ଟର ବଦଳାନ୍ତୁ", providersFound: "ପ୍ରଦାୟକ ମିଳିଲେ",
    messages: "ବାର୍ତ୍ତା", noMessagesYet: "ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି ବାର୍ତ୍ତା ନାହିଁ",
    noMessagesDesc: "ଦକ୍ଷ ପ୍ରଦାୟକ ଖୋଜନ୍ତୁ ଓ ବାର୍ତ୍ତାଳାପ ଆରମ୍ଭ କରନ୍ତୁ।",
    findProviders: "ପ୍ରଦାୟକ ଖୋଜନ୍ତୁ", message: "ବାର୍ତ୍ତା",
    notifications: "ବିଜ୍ଞପ୍ତି", unread: "ଅପଢ଼ା", markAllRead: "ସବୁ ପଢ଼ା ଚିହ୍ନ କରନ୍ତୁ",
    pushNotifActive: "ପୁଶ ବିଜ୍ଞପ୍ତି ସକ୍ରିୟ — ବୁକିଙ୍ଗ ଚେତାବନୀ ତୁରନ୍ତ ଆସେ",
    noNotificationsYet: "ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି ବିଜ୍ଞପ୍ତି ନାହିଁ",
    notifDesc: "ଗ୍ରାହକ ବୁକିଙ୍ଗ ଅନୁରୋଧ ପଠାଇଲେ ଆପଣଙ୍କୁ ଜଣାଯିବ।",
    justNow: "ଏବେ",
    dashboard: "ଡ୍ୟାସ୍‌ବୋର୍ଡ", becomeProvider: "ପ୍ରଦାୟକ ହୁଅ",
    becomeProviderDesc: "ଆପଣଙ୍କ ଦକ୍ଷତା ପଞ୍ଜୀ କରନ୍ତୁ ଓ ନିକଟ ଗ୍ରାହକଙ୍କ ଠୁ ବୁକିଙ୍ଗ ପାଅ।",
    quickActions: "ଦ୍ରୁତ ପଦକ୍ଷେପ", earnings: "ଉପାର୍ଜନ", myListing: "ମୋ ତାଲିକା",
    reviews: "ସମୀକ୍ଷା", share: "ଅଂଶୀଦାର", bookingRequests: "ବୁକିଙ୍ଗ ଅନୁରୋଧ",
    newLabel: "ନୂଆ", pending: "ବାକି", active: "ସକ୍ରିୟ", done: "ସମ୍ପୂର୍ଣ",
    ratingLabel: "ରେଟିଙ୍ଗ", availableForJobs: "କାମ ପାଇଁ ଉପଲବ୍ଧ",
    notAvailable: "ଉପଲବ୍ଧ ନୁହେଁ", online: "ଅନ୍‌ଲାଇନ", offline: "ଅଫ୍‌ଲାଇନ",
    estimatedEarnings: "ଆନୁମାନିକ ଉପାର୍ଜନ", fromCompletedJobs: "ସମ୍ପୂର୍ଣ କାର୍ଯ୍ୟ ଠୁ",
    noBookingRequests: "ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି ବୁକିଙ୍ଗ ଅନୁରୋଧ ନାହିଁ",
    noBookingDesc: "ଗ୍ରାହକ ବୁକିଙ୍ଗ ଅନୁରୋଧ ପଠାଇଲେ ଇଠି ଦେଖିବ।",
    markDone: "ସମ୍ପୂର୍ଣ", accept: "ଗ୍ରହଣ", decline: "ଅସ୍ୱୀକାର",
    markComplete: "ସମ୍ପୂର୍ଣ ଚିହ୍ନ", markCompleteConfirm: "ଏ କାମ ସମ୍ପୂର୍ଣ?",
    declineBooking: "ବୁକିଙ୍ଗ ଅସ୍ୱୀକାର",
    declineBookingConfirm: "ଆପଣ ଏ ଅନୁରୋଧ ଅସ୍ୱୀକାର କରିବାକୁ ଚାହୁଁଛନ୍ତି?",
    service: "ସେବା", date: "ତାରିଖ", time: "ସମୟ", budget: "ବଜେଟ",
  },

  Punjabi: {
    account: "ਖਾਤਾ", support: "ਸਹਾਇਤਾ", editProfile: "ਪ੍ਰੋਫਾਈਲ ਸੰਪਾਦਿਤ ਕਰੋ",
    myLocation: "ਮੇਰੀ ਜਗ੍ਹਾ", language: "ਭਾਸ਼ਾ", helpCenter: "ਮਦਦ ਕੇਂਦਰ",
    termsOfService: "ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ", privacyPolicy: "ਗੋਪਨੀਯਤਾ ਨੀਤੀ", signOut: "ਸਾਈਨ ਆਊਟ",
    youreOnline: "ਤੁਸੀਂ ਔਨਲਾਈਨ ਹੋ", youreOffline: "ਤੁਸੀਂ ਔਫਲਾਈਨ ਹੋ",
    customersCanFind: "ਗਾਹਕ ਤੁਹਾਨੂੰ ਲੱਭ ਸਕਦੇ ਹਨ",
    wontReceiveBookings: "ਤੁਹਾਨੂੰ ਨਵੀਂ ਬੁਕਿੰਗ ਨਹੀਂ ਮਿਲੇਗੀ",
    registerAsProvider: "ਸੇਵਾ ਪ੍ਰਦਾਤਾ ਵਜੋਂ ਰਜਿਸਟਰ ਕਰੋ",
    earnMoneyWithSkills: "ਆਪਣੇ ਹੁਨਰ ਨਾਲ ਕਮਾਓ",
    inviteFriends: "ਦੋਸਤਾਂ ਨੂੰ ਸੱਦਾ ਦਿਓ",
    shareWithFriendsFamily: "ਦੋਸਤਾਂ ਅਤੇ ਪਰਿਵਾਰ ਨਾਲ SkillAd ਸਾਂਝਾ ਕਰੋ",
    verifiedProvider: "ਪ੍ਰਮਾਣਿਤ ਪ੍ਰਦਾਤਾ", selectCity: "ਆਪਣਾ ਸ਼ਹਿਰ ਚੁਣੋ",
    selectLanguage: "ਭਾਸ਼ਾ ਚੁਣੋ", signOutTitle: "ਸਾਈਨ ਆਊਟ",
    signOutMessage: "ਕੀ ਤੁਸੀਂ ਸਾਈਨ ਆਊਟ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?", signOutConfirm: "ਸਾਈਨ ਆਊਟ", cancel: "ਰੱਦ ਕਰੋ",
    hi: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ,", detectingLocation: "ਟਿਕਾਣਾ ਲੱਭ ਰਹੇ ਹਾਂ...", categories: "ਸ਼੍ਰੇਣੀਆਂ",
    nearbySkilled: "ਨੇੜੇ ਦੇ ਹੁਨਰਮੰਦ ਕਾਮੇ", viewAll: "ਸਭ ਦੇਖੋ",
    noProvidersFound: "ਕੋਈ ਪ੍ਰਦਾਤਾ ਨਹੀਂ ਮਿਲਿਆ", offerSkills: "ਹੁਨਰ ਦਿਓ",
    searchPlaceholder: "ਹੁਨਰ ਜਾਂ ਸੇਵਾ ਲੱਭੋ...",
    searchSkills: "ਹੁਨਰ, ਸੇਵਾਵਾਂ ਲੱਭੋ...", availableNow: "ਹੁਣੇ ਉਪਲਬਧ",
    nearest: "ਸਭ ਤੋਂ ਨੇੜੇ", topRated: "ਉੱਚ ਰੇਟਿੰਗ", mostReviews: "ਸਭ ਤੋਂ ਵੱਧ ਸਮੀਖਿਆ",
    within: "ਅੰਦਰ", noProvidersMatch: "ਕੋਈ ਪ੍ਰਦਾਤਾ ਫਿਲਟਰ ਨਾਲ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ",
    tryAdjustingFilters: "ਆਪਣੀ ਖੋਜ ਜਾਂ ਫਿਲਟਰ ਬਦਲੋ", providersFound: "ਪ੍ਰਦਾਤਾ ਮਿਲੇ",
    messages: "ਸੁਨੇਹੇ", noMessagesYet: "ਹਾਲੇ ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ",
    noMessagesDesc: "ਹੁਨਰਮੰਦ ਪ੍ਰਦਾਤਾ ਲੱਭੋ ਅਤੇ ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰੋ।",
    findProviders: "ਪ੍ਰਦਾਤਾ ਲੱਭੋ", message: "ਸੁਨੇਹਾ",
    notifications: "ਸੂਚਨਾਵਾਂ", unread: "ਨਾ ਪੜ੍ਹਿਆ", markAllRead: "ਸਭ ਪੜ੍ਹਿਆ ਕਰੋ",
    pushNotifActive: "ਪੁਸ਼ ਸੂਚਨਾਵਾਂ ਸਰਗਰਮ — ਬੁਕਿੰਗ ਚੇਤਾਵਨੀ ਤੁਰੰਤ ਮਿਲਦੀ",
    noNotificationsYet: "ਹਾਲੇ ਕੋਈ ਸੂਚਨਾ ਨਹੀਂ",
    notifDesc: "ਜਦੋਂ ਗਾਹਕ ਬੁਕਿੰਗ ਬੇਨਤੀ ਭੇਜਣਗੇ, ਤੁਹਾਨੂੰ ਦੱਸਿਆ ਜਾਵੇਗਾ।",
    justNow: "ਹੁਣੇ",
    dashboard: "ਡੈਸ਼ਬੋਰਡ", becomeProvider: "ਪ੍ਰਦਾਤਾ ਬਣੋ",
    becomeProviderDesc: "ਆਪਣਾ ਹੁਨਰ ਦਰਜ਼ ਕਰੋ ਅਤੇ ਨੇੜੇ ਦੇ ਗਾਹਕਾਂ ਤੋਂ ਬੁਕਿੰਗ ਪ੍ਰਾਪਤ ਕਰੋ।",
    quickActions: "ਤੇਜ਼ ਕਾਰਵਾਈਆਂ", earnings: "ਕਮਾਈ", myListing: "ਮੇਰੀ ਸੂਚੀ",
    reviews: "ਸਮੀਖਿਆਵਾਂ", share: "ਸਾਂਝਾ ਕਰੋ", bookingRequests: "ਬੁਕਿੰਗ ਬੇਨਤੀਆਂ",
    newLabel: "ਨਵਾਂ", pending: "ਬਾਕੀ", active: "ਸਰਗਰਮ", done: "ਪੂਰਾ",
    ratingLabel: "ਰੇਟਿੰਗ", availableForJobs: "ਕੰਮ ਲਈ ਉਪਲਬਧ",
    notAvailable: "ਉਪਲਬਧ ਨਹੀਂ", online: "ਔਨਲਾਈਨ", offline: "ਔਫਲਾਈਨ",
    estimatedEarnings: "ਅਨੁਮਾਨਿਤ ਕਮਾਈ", fromCompletedJobs: "ਮੁਕੰਮਲ ਕੰਮਾਂ ਤੋਂ",
    noBookingRequests: "ਹਾਲੇ ਕੋਈ ਬੁਕਿੰਗ ਬੇਨਤੀ ਨਹੀਂ",
    noBookingDesc: "ਜਦੋਂ ਗਾਹਕ ਬੁਕਿੰਗ ਬੇਨਤੀ ਭੇਜਣਗੇ, ਇੱਥੇ ਦਿਖਣਗੇ।",
    markDone: "ਪੂਰਾ ਕਰੋ", accept: "ਮੰਜ਼ੂਰ", decline: "ਨਾਂਹ",
    markComplete: "ਪੂਰਾ ਕਰੋ", markCompleteConfirm: "ਇਹ ਕੰਮ ਪੂਰਾ ਕਰਨਾ?",
    declineBooking: "ਬੁਕਿੰਗ ਨਾਂਹ",
    declineBookingConfirm: "ਕੀ ਤੁਸੀਂ ਇਹ ਬੇਨਤੀ ਰੱਦ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?",
    service: "ਸੇਵਾ", date: "ਤਾਰੀਖ਼", time: "ਸਮਾਂ", budget: "ਬਜਟ",
  },

  Sanskrit: {
    account: "लेखा", support: "सहायता", editProfile: "परिचयं सम्पादयतु",
    myLocation: "मम स्थानम्", language: "भाषा", helpCenter: "सहायता केन्द्रम्",
    termsOfService: "सेवा नियमाः", privacyPolicy: "गोपनीयता नीतिः", signOut: "निष्क्रमणम्",
    youreOnline: "भवान् ऑनलाइन अस्ति", youreOffline: "भवान् ऑफलाइन अस्ति",
    customersCanFind: "ग्राहकाः भवन्तं प्राप्तुं शक्नुवन्ति",
    wontReceiveBookings: "भवान् नवीनं बुकिंग न प्राप्स्यति",
    registerAsProvider: "प्रदातृरूपेण नोंदयतु",
    earnMoneyWithSkills: "स्वकौशलेन अर्जयतु",
    inviteFriends: "मित्रान् आमन्त्रयतु",
    shareWithFriendsFamily: "मित्रैः कुटुम्बैश्च SkillAd भागयतु",
    verifiedProvider: "प्रमाणित प्रदाता", selectCity: "स्वनगरं चिनुत",
    selectLanguage: "भाषां चिनुत", signOutTitle: "निष्क्रमणम्",
    signOutMessage: "किम् भवान् निष्क्रमितुं इच्छति?", signOutConfirm: "निष्क्रमणम्", cancel: "रद्द",
    hi: "नमस्ते,", detectingLocation: "स्थानं ज्ञायते...", categories: "विभागाः",
    nearbySkilled: "समीपस्थाः कुशलाः", viewAll: "सर्वं पश्यतु",
    noProvidersFound: "प्रदाता न लब्धः", offerSkills: "कौशलं यच्छतु",
    searchPlaceholder: "कौशलं सेवां वा अन्विष्यतु...",
    searchSkills: "कौशलं सेवा अन्विष्यतु...", availableNow: "अधुना उपलब्धम्",
    nearest: "अतिसमीपः", topRated: "शीर्षरेटः", mostReviews: "बहुसमीक्षाः",
    within: "अन्तः", noProvidersMatch: "फिल्टरेण प्रदाता न मिलति",
    tryAdjustingFilters: "फिल्टरं परिवर्तयतु", providersFound: "प्रदाताः लब्धाः",
    messages: "सन्देशाः", noMessagesYet: "सन्देशाः न सन्ति",
    noMessagesDesc: "कुशलं प्रदातारं प्राप्य संवादं आरभतु।",
    findProviders: "प्रदातृन् अन्विष्यतु", message: "सन्देशः",
    notifications: "सूचनाः", unread: "अपठितम्", markAllRead: "सर्वं पठितम्",
    pushNotifActive: "Push notifications active — booking alerts तुरंत",
    noNotificationsYet: "सूचनाः न सन्ति",
    notifDesc: "ग्राहकाः booking request प्रेषयन्ति, भवान् जानिष्यति।",
    justNow: "अधुना",
    dashboard: "Dashboard", becomeProvider: "प्रदाता भवतु",
    becomeProviderDesc: "कौशलं नोंदयतु, समीपस्थेभ्यः ग्राहकेभ्यः booking प्राप्नोतु।",
    quickActions: "त्वरितकार्याणि", earnings: "अर्जनम्", myListing: "मम सूची",
    reviews: "समीक्षाः", share: "भागयतु", bookingRequests: "Booking Requests",
    newLabel: "नवम्", pending: "प्रतीक्षमाणम्", active: "सक्रियम्", done: "सम्पन्नम्",
    ratingLabel: "मूल्याङ्कनम्", availableForJobs: "कार्याय उपलब्धः",
    notAvailable: "अनुपलब्धः", online: "Online", offline: "Offline",
    estimatedEarnings: "अनुमानितम् अर्जनम्", fromCompletedJobs: "सम्पन्नेभ्यः कार्येभ्यः",
    noBookingRequests: "Booking requests न सन्ति",
    noBookingDesc: "ग्राहकाः booking request प्रेषयन्ति, अत्र दृश्यते।",
    markDone: "सम्पन्नम्", accept: "स्वीकृतम्", decline: "अस्वीकृतम्",
    markComplete: "पूर्णं करोतु", markCompleteConfirm: "कार्यं पूर्णम्?",
    declineBooking: "Booking अस्वीकृतम्",
    declineBookingConfirm: "Request अस्वीकर्तुं इच्छति?",
    service: "सेवा", date: "दिनाङ्कः", time: "समयः", budget: "Budget",
  },

  Santali: {
    account: "Account", support: "Sohay", editProfile: "Profile Badol",
    myLocation: "Aam Jaygah", language: "Bhashar", helpCenter: "Sohay Kendra",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", signOut: "Sign Out",
    youreOnline: "Aapun Online", youreOffline: "Aapun Offline",
    customersCanFind: "Customer aapun ke khoj sake", wontReceiveBookings: "Aapun booking nai pabe",
    registerAsProvider: "Provider hisab register", earnMoneyWithSkills: "Skill se kamaao",
    inviteFriends: "Miyad ke invite", shareWithFriendsFamily: "Miyad ar poribar SkillAd share",
    verifiedProvider: "Verified Provider", selectCity: "Sheher chun",
    selectLanguage: "Bhashar chun", signOutTitle: "Sign Out",
    signOutMessage: "Sign out korbe?", signOutConfirm: "Sign Out", cancel: "Na",
    hi: "Johar,", detectingLocation: "Jaygah khoji achi...", categories: "Category",
    nearbySkilled: "Lagit Skilled Worker", viewAll: "Hobnai Bai",
    noProvidersFound: "Provider nai pela", offerSkills: "Skill De",
    searchPlaceholder: "Skill ba seva khoji...",
    searchSkills: "Skill, seva khoji...", availableNow: "Athu Available",
    nearest: "Sobse Lagit", topRated: "Top Rated", mostReviews: "Most Reviews",
    within: "Bhitor", noProvidersMatch: "Filter diye provider nai pela",
    tryAdjustingFilters: "Filter badlo", providersFound: "provider pela",
    messages: "Message", noMessagesYet: "Message nai",
    noMessagesDesc: "Provider khoji, message kor.",
    findProviders: "Provider Khoji", message: "Message",
    notifications: "Khabar", unread: "Nai porha", markAllRead: "Hobnai Porha",
    pushNotifActive: "Push notification active — booking alert athu aaybe",
    noNotificationsYet: "Khabar nai",
    notifDesc: "Customer booking korle, aapun ke janabo.",
    justNow: "Athu",
    dashboard: "Dashboard", becomeProvider: "Provider Ho",
    becomeProviderDesc: "Skill register kor, lagit customer paikhri booking pao.",
    quickActions: "Quick Actions", earnings: "Taka", myListing: "Aapun List",
    reviews: "Mot", share: "Share", bookingRequests: "Booking Request",
    newLabel: "Nawa", pending: "Baki", active: "Active", done: "Shamai",
    ratingLabel: "Rating", availableForJobs: "Kam lagi available",
    notAvailable: "Available nai", online: "Online", offline: "Offline",
    estimatedEarnings: "Taka Andaj", fromCompletedJobs: "Shamai kam paikhri",
    noBookingRequests: "Booking request nai",
    noBookingDesc: "Customer booking korle, aaite dekhabo.",
    markDone: "Shamai", accept: "Maan", decline: "Na",
    markComplete: "Poura Mark", markCompleteConfirm: "Kaam shamai?",
    declineBooking: "Booking Na",
    declineBookingConfirm: "Request decline korbe?",
    service: "Seva", date: "Din", time: "Samay", budget: "Budget",
  },

  Sindhi: {
    account: "खातो", support: "मदद", editProfile: "प्रोफाइल बदलो",
    myLocation: "मंहिंजी जाई", language: "ज़बान", helpCenter: "मदद मरकज़",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", signOut: "साइन आउट",
    youreOnline: "तूं ऑनलाइन आहें", youreOffline: "तूं ऑफलाइन आहें",
    customersCanFind: "ग्राहक तुंहिंजे ढूंढी सघदा",
    wontReceiveBookings: "तुंहिंकू नवी बुकिंग न मिलिंदी",
    registerAsProvider: "प्रदाता रूप रजिस्टर करो",
    earnMoneyWithSkills: "पंहिंजी काबिलियत सान कमाओ",
    inviteFriends: "दोस्तन खे दावत डियो",
    shareWithFriendsFamily: "दोस्त ते कुटुंब सान SkillAd शेयर करो",
    verifiedProvider: "Verified Provider", selectCity: "पंहिंजो शहर चुनो",
    selectLanguage: "ज़बान चुनो", signOutTitle: "साइन आउट",
    signOutMessage: "क्या तूं साइन आउट करणु चाहें?", signOutConfirm: "साइन आउट", cancel: "रद्द करो",
    hi: "सलाम,", detectingLocation: "जाई ढूंढींदा...", categories: "विभाग",
    nearbySkilled: "नेड़े हुनरमंद", viewAll: "सभ डसो",
    noProvidersFound: "कोई प्रदाता न मिल्यो", offerSkills: "हुनर डियो",
    searchPlaceholder: "हुनर या सेवा ढूंढो...",
    searchSkills: "हुनर, सेवा ढूंढो...", availableNow: "हाणि उपलब्ध",
    nearest: "सभ खां नेड़ो", topRated: "Top Rated", mostReviews: "Most Reviews",
    within: "अंदर", noProvidersMatch: "फिल्टर सान कोई प्रदाता न मिल्यो",
    tryAdjustingFilters: "खोज या फिल्टर बदलो", providersFound: "प्रदाता मिले",
    messages: "पैगाम", noMessagesYet: "कोई पैगाम ना",
    noMessagesDesc: "हुनरमंद प्रदाता ढूंढो ते गुफ्तगू शुरू करो।",
    findProviders: "प्रदाता ढूंढो", message: "पैगाम",
    notifications: "इत्तला", unread: "अनपढ़यल", markAllRead: "सभ पढ़यल करो",
    pushNotifActive: "Push notifications active — booking alerts हाणि मिलिंदा",
    noNotificationsYet: "कोई इत्तला ना",
    notifDesc: "ग्राहक booking request घलिण, तुंहिंकू जाणयो वेंदो।",
    justNow: "हाणि",
    dashboard: "Dashboard", becomeProvider: "Provider बणो",
    becomeProviderDesc: "हुनर register करो ते नेड़न ग्राहकन कां booking वठो।",
    quickActions: "Quick Actions", earnings: "कमाई", myListing: "मंहिंजी सूची",
    reviews: "समीक्षा", share: "शेयर", bookingRequests: "Booking Request",
    newLabel: "नवो", pending: "बाकी", active: "सक्रिय", done: "पूरो",
    ratingLabel: "Rating", availableForJobs: "काम खे उपलब्ध",
    notAvailable: "उपलब्ध ना", online: "Online", offline: "Offline",
    estimatedEarnings: "अंदाज़न कमाई", fromCompletedJobs: "पूरन कामन मां",
    noBookingRequests: "कोई booking request ना",
    noBookingDesc: "ग्राहक booking request घलिण, हत्थां डसिंदो।",
    markDone: "पूरो करो", accept: "मंजूर", decline: "ना",
    markComplete: "पूरो Mark करो", markCompleteConfirm: "हि काम पूरो?",
    declineBooking: "Booking ना",
    declineBookingConfirm: "Request ना करणु चाहें?",
    service: "सेवा", date: "तारीख", time: "वकत", budget: "Budget",
  },

  Tamil: {
    account: "கணக்கு", support: "உதவி", editProfile: "சுயவிவரத்தை திருத்து",
    myLocation: "என் இடம்", language: "மொழி", helpCenter: "உதவி மையம்",
    termsOfService: "சேவை விதிமுறைகள்", privacyPolicy: "தனியுரிமை கொள்கை", signOut: "வெளியேறு",
    youreOnline: "நீங்கள் ஆன்லைனில் இருக்கிறீர்கள்", youreOffline: "நீங்கள் ஆஃப்லைனில் இருக்கிறீர்கள்",
    customersCanFind: "வாடிக்கையாளர்கள் உங்களை கண்டுபிடிக்கலாம்",
    wontReceiveBookings: "உங்களுக்கு புதிய முன்பதிவுகள் கிடைக்காது",
    registerAsProvider: "வழங்குநராக பதிவு செய்யுங்கள்",
    earnMoneyWithSkills: "உங்கள் திறமையால் சம்பாதியுங்கள்",
    inviteFriends: "நண்பர்களை அழையுங்கள்",
    shareWithFriendsFamily: "நண்பர்கள் மற்றும் குடும்பத்தினருடன் SkillAd பகிரவும்",
    verifiedProvider: "சரிபார்க்கப்பட்ட வழங்குநர்", selectCity: "உங்கள் நகரத்தை தேர்ந்தெடுங்கள்",
    selectLanguage: "மொழியைத் தேர்ந்தெடுங்கள்", signOutTitle: "வெளியேறு",
    signOutMessage: "நீங்கள் வெளியேற விரும்புகிறீர்களா?", signOutConfirm: "வெளியேறு", cancel: "ரத்து செய்",
    hi: "வணக்கம்,", detectingLocation: "இடம் கண்டறிகிறோம்...", categories: "வகைகள்",
    nearbySkilled: "அருகில் உள்ள திறமையாளர்கள்", viewAll: "அனைத்தும் பார்க்கவும்",
    noProvidersFound: "வழங்குநர்கள் கிடைக்கவில்லை", offerSkills: "திறமை தாருங்கள்",
    searchPlaceholder: "திறமை அல்லது சேவை தேடுங்கள்...",
    searchSkills: "திறமை, சேவைகள் தேடுங்கள்...", availableNow: "இப்போது கிடைக்கும்",
    nearest: "மிக அருகில்", topRated: "உயர் மதிப்பீடு", mostReviews: "அதிக விமர்சனங்கள்",
    within: "உள்ளே", noProvidersMatch: "எந்த வழங்குநரும் வடிகட்டியுடன் பொருந்தவில்லை",
    tryAdjustingFilters: "உங்கள் தேடல் அல்லது வடிகட்டியை மாற்றுங்கள்", providersFound: "வழங்குநர்கள் கிடைத்தனர்",
    messages: "செய்திகள்", noMessagesYet: "இன்னும் செய்திகள் இல்லை",
    noMessagesDesc: "திறமையான வழங்குநரைத் தேடி உரையாடலை தொடங்குங்கள்.",
    findProviders: "வழங்குநர்களை தேடுங்கள்", message: "செய்தி",
    notifications: "அறிவிப்புகள்", unread: "படிக்காதது", markAllRead: "அனைத்தையும் படித்ததாக குறிக்கவும்",
    pushNotifActive: "புஷ் அறிவிப்புகள் செயலில் — முன்பதிவு எச்சரிக்கை உடனடியாக வரும்",
    noNotificationsYet: "இன்னும் அறிவிப்புகள் இல்லை",
    notifDesc: "வாடிக்கையாளர்கள் முன்பதிவு கோரிக்கை அனுப்பும்போது நீங்கள் அறிவிக்கப்படுவீர்கள்.",
    justNow: "இப்போதே",
    dashboard: "டாஷ்போர்டு", becomeProvider: "வழங்குநராகுங்கள்",
    becomeProviderDesc: "உங்கள் திறமையை பதிவு செய்து அருகிலுள்ள வாடிக்கையாளர்களிடமிருந்து முன்பதிவு பெறுங்கள்.",
    quickActions: "விரைவு செயல்கள்", earnings: "வருமானம்", myListing: "என் பட்டியல்",
    reviews: "விமர்சனங்கள்", share: "பகிர்", bookingRequests: "முன்பதிவு கோரிக்கைகள்",
    newLabel: "புதிய", pending: "நிலுவை", active: "செயலில்", done: "முடிந்தது",
    ratingLabel: "மதிப்பீடு", availableForJobs: "வேலைக்கு கிடைக்கும்",
    notAvailable: "கிடைக்கவில்லை", online: "ஆன்லைன்", offline: "ஆஃப்லைன்",
    estimatedEarnings: "மதிப்பிட்ட வருமானம்", fromCompletedJobs: "முடிந்த வேலைகளிலிருந்து",
    noBookingRequests: "இன்னும் முன்பதிவு கோரிக்கைகள் இல்லை",
    noBookingDesc: "வாடிக்கையாளர்கள் முன்பதிவு கோரிக்கை அனுப்பும்போது இங்கே தெரியும்.",
    markDone: "முடிந்தது", accept: "ஏற்கவும்", decline: "நிராகரிக்கவும்",
    markComplete: "முடிந்ததாக குறிக்கவும்", markCompleteConfirm: "இந்த வேலையை முடிக்கவா?",
    declineBooking: "முன்பதிவை நிராகரி",
    declineBookingConfirm: "இந்த கோரிக்கையை நிராகரிக்க விரும்புகிறீர்களா?",
    service: "சேவை", date: "தேதி", time: "நேரம்", budget: "பட்ஜெட்",
  },

  Telugu: {
    account: "ఖాతా", support: "సహాయం", editProfile: "ప్రొఫైల్ సవరించు",
    myLocation: "నా స్థానం", language: "భాష", helpCenter: "సహాయ కేంద్రం",
    termsOfService: "సేవా నిబంధనలు", privacyPolicy: "గోప్యతా విధానం", signOut: "సైన్ అవుట్",
    youreOnline: "మీరు ఆన్‌లైన్‌లో ఉన్నారు", youreOffline: "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు",
    customersCanFind: "కస్టమర్లు మిమ్మల్ని కనుగొనగలరు",
    wontReceiveBookings: "మీకు కొత్త బుకింగ్‌లు వచ్చవు",
    registerAsProvider: "సేవా ప్రదాతగా నమోదు చేసుకోండి",
    earnMoneyWithSkills: "మీ నైపుణ్యంతో సంపాదించండి",
    inviteFriends: "స్నేహితులను ఆహ్వానించండి",
    shareWithFriendsFamily: "స్నేహితులు మరియు కుటుంబంతో SkillAd భాగస్వామ్యం చేయండి",
    verifiedProvider: "ధృవీకరించబడిన ప్రదాత", selectCity: "మీ నగరాన్ని ఎంచుకోండి",
    selectLanguage: "భాషను ఎంచుకోండి", signOutTitle: "సైన్ అవుట్",
    signOutMessage: "మీరు సైన్ అవుట్ అవ్వాలనుకుంటున్నారా?", signOutConfirm: "సైన్ అవుట్", cancel: "రద్దు చేయండి",
    hi: "నమస్కారం,", detectingLocation: "స్థానం గుర్తిస్తున్నాం...", categories: "వర్గాలు",
    nearbySkilled: "దగ్గరలోని నిపుణులు", viewAll: "అన్నీ చూడండి",
    noProvidersFound: "ప్రదాతలు కనుగొనబడలేదు", offerSkills: "నైపుణ్యం ఇవ్వండి",
    searchPlaceholder: "నైపుణ్యం లేదా సేవ వెతకండి...",
    searchSkills: "నైపుణ్యాలు, సేవలు వెతకండి...", availableNow: "ఇప్పుడు అందుబాటులో",
    nearest: "అత్యంత దగ్గరలో", topRated: "అగ్ర రేటింగ్", mostReviews: "ఎక్కువ సమీక్షలు",
    within: "లోపల", noProvidersMatch: "ఏ ప్రదాత ఫిల్టర్‌తో సరిపోలలేదు",
    tryAdjustingFilters: "మీ శోధన లేదా ఫిల్టర్ మార్చండి", providersFound: "ప్రదాతలు కనుగొనబడ్డారు",
    messages: "సందేశాలు", noMessagesYet: "ఇంకా సందేశాలు లేవు",
    noMessagesDesc: "నిపుణుడైన ప్రదాతను కనుగొని సంభాషణ ప్రారంభించండి.",
    findProviders: "ప్రదాతలను వెతకండి", message: "సందేశం",
    notifications: "నోటిఫికేషన్లు", unread: "చదవనిది", markAllRead: "అన్నీ చదివినట్లు గుర్తించండి",
    pushNotifActive: "పుష్ నోటిఫికేషన్లు సక్రియంగా ఉన్నాయి — బుకింగ్ హెచ్చరిక వెంటనే వస్తుంది",
    noNotificationsYet: "ఇంకా నోటిఫికేషన్లు లేవు",
    notifDesc: "కస్టమర్లు బుకింగ్ అభ్యర్థనలు పంపినప్పుడు మీకు తెలియజేయబడుతుంది.",
    justNow: "ఇప్పుడే",
    dashboard: "డాష్‌బోర్డ్", becomeProvider: "ప్రదాత అవ్వండి",
    becomeProviderDesc: "మీ నైపుణ్యాన్ని నమోదు చేసి దగ్గరలోని కస్టమర్ల నుండి బుకింగ్ పొందండి.",
    quickActions: "త్వరిత చర్యలు", earnings: "సంపాదన", myListing: "నా జాబితా",
    reviews: "సమీక్షలు", share: "భాగస్వామ్యం", bookingRequests: "బుకింగ్ అభ్యర్థనలు",
    newLabel: "కొత్త", pending: "పెండింగ్", active: "క్రియాశీలం", done: "పూర్తయింది",
    ratingLabel: "రేటింగ్", availableForJobs: "పని కోసం అందుబాటులో",
    notAvailable: "అందుబాటులో లేదు", online: "ఆన్‌లైన్", offline: "ఆఫ్‌లైన్",
    estimatedEarnings: "అంచనా సంపాదన", fromCompletedJobs: "పూర్తైన పనుల నుండి",
    noBookingRequests: "ఇంకా బుకింగ్ అభ్యర్థనలు లేవు",
    noBookingDesc: "కస్టమర్లు బుకింగ్ అభ్యర్థనలు పంపినప్పుడు ఇక్కడ కనిపిస్తాయి.",
    markDone: "పూర్తయింది", accept: "అంగీకరించండి", decline: "తిరస్కరించండి",
    markComplete: "పూర్తి గుర్తించండి", markCompleteConfirm: "ఈ పనిని పూర్తి చేయాలా?",
    declineBooking: "బుకింగ్ తిరస్కరించండి",
    declineBookingConfirm: "మీరు ఈ అభ్యర్థనను తిరస్కరించాలనుకుంటున్నారా?",
    service: "సేవ", date: "తేదీ", time: "సమయం", budget: "బడ్జెట్",
  },

  Urdu: {
    account: "اکاؤنٹ", support: "مدد", editProfile: "پروفائل تبدیل کریں",
    myLocation: "میرا مقام", language: "زبان", helpCenter: "مدد مرکز",
    termsOfService: "خدمت کی شرائط", privacyPolicy: "رازداری پالیسی", signOut: "سائن آؤٹ",
    youreOnline: "آپ آن لائن ہیں", youreOffline: "آپ آف لائن ہیں",
    customersCanFind: "گاہک آپ کو ڈھونڈ سکتے ہیں",
    wontReceiveBookings: "آپ کو نئی بکنگ نہیں ملے گی",
    registerAsProvider: "سروس فراہم کنندہ کے طور پر رجسٹر کریں",
    earnMoneyWithSkills: "اپنی صلاحیتوں سے کمائیں",
    inviteFriends: "دوستوں کو مدعو کریں",
    shareWithFriendsFamily: "دوستوں اور خاندان کے ساتھ SkillAd شیئر کریں",
    verifiedProvider: "تصدیق شدہ فراہم کنندہ", selectCity: "اپنا شہر منتخب کریں",
    selectLanguage: "زبان منتخب کریں", signOutTitle: "سائن آؤٹ",
    signOutMessage: "کیا آپ سائن آؤٹ کرنا چاہتے ہیں؟", signOutConfirm: "سائن آؤٹ", cancel: "منسوخ کریں",
    hi: "السلام علیکم,", detectingLocation: "مقام معلوم ہو رہا ہے...", categories: "زمرے",
    nearbySkilled: "قریبی ماہر کارکن", viewAll: "سب دیکھیں",
    noProvidersFound: "کوئی فراہم کنندہ نہیں ملا", offerSkills: "ہنر پیش کریں",
    searchPlaceholder: "ہنر یا خدمت تلاش کریں...",
    searchSkills: "ہنر، خدمات تلاش کریں...", availableNow: "ابھی دستیاب",
    nearest: "سب سے قریب", topRated: "بہترین درجہ بندی", mostReviews: "سب سے زیادہ جائزے",
    within: "اندر", noProvidersMatch: "کوئی فراہم کنندہ فلٹر سے میل نہیں کھاتا",
    tryAdjustingFilters: "اپنی تلاش یا فلٹر تبدیل کریں", providersFound: "فراہم کنندگان ملے",
    messages: "پیغامات", noMessagesYet: "ابھی کوئی پیغام نہیں",
    noMessagesDesc: "ماہر فراہم کنندہ ڈھونڈیں اور گفتگو شروع کریں۔",
    findProviders: "فراہم کنندگان ڈھونڈیں", message: "پیغام",
    notifications: "اطلاعات", unread: "غیر پڑھا", markAllRead: "سب پڑھا ہوا کریں",
    pushNotifActive: "پش اطلاعات فعال — بکنگ الرٹ فوری ملتا ہے",
    noNotificationsYet: "ابھی کوئی اطلاع نہیں",
    notifDesc: "جب گاہک بکنگ درخواستیں بھیجیں گے تو آپ کو مطلع کیا جائے گا۔",
    justNow: "ابھی",
    dashboard: "ڈیش بورڈ", becomeProvider: "فراہم کنندہ بنیں",
    becomeProviderDesc: "اپنا ہنر درج کریں اور قریبی گاہکوں سے بکنگ حاصل کریں۔",
    quickActions: "فوری اقدامات", earnings: "کمائی", myListing: "میری فہرست",
    reviews: "جائزے", share: "شیئر کریں", bookingRequests: "بکنگ درخواستیں",
    newLabel: "نیا", pending: "زیر التوا", active: "فعال", done: "مکمل",
    ratingLabel: "درجہ بندی", availableForJobs: "کام کے لیے دستیاب",
    notAvailable: "دستیاب نہیں", online: "آن لائن", offline: "آف لائن",
    estimatedEarnings: "متوقع کمائی", fromCompletedJobs: "مکمل کاموں سے",
    noBookingRequests: "ابھی کوئی بکنگ درخواست نہیں",
    noBookingDesc: "جب گاہک بکنگ درخواستیں بھیجیں گے تو یہاں ظاہر ہوں گی۔",
    markDone: "مکمل کریں", accept: "قبول کریں", decline: "مسترد",
    markComplete: "مکمل نشان لگائیں", markCompleteConfirm: "کیا یہ کام مکمل کریں؟",
    declineBooking: "بکنگ مسترد",
    declineBookingConfirm: "کیا آپ یہ درخواست مسترد کرنا چاہتے ہیں؟",
    service: "خدمت", date: "تاریخ", time: "وقت", budget: "بجٹ",
  },
};
/** Newly added UI strings — English copied to all languages until verified translations exist. */
const EXTRA_STRINGS: Omit<Strings, keyof CoreStrings> = {
  connectWithSkilled: "Connect with Skilled\nProfessionals Near You",
  hireSkillsTagline: "Hire Skills. Get Work. All in One Place.",
  workers: "Workers",
  servicesLabel: "Services",
  cities: "Cities",
  welcomeBack: "Welcome Back",
  signInToContinue: "Sign in to continue",
  iAmA: "I am a",
  customer: "Customer",
  serviceProvider: "Service Provider",
  fullName: "Full Name",
  enterFullName: "Enter your full name",
  mobileNumber: "Mobile Number",
  enterMobileNumber: "Enter mobile number",
  sendOtp: "Send OTP",
  agreeToTermsPrivacy: "By continuing, you agree to our Terms of Service and Privacy Policy",
  enterAll6Digits: "Please enter all 6 digits",
  otpResentSuccess: "OTP resent successfully",
  otpResendFailed: "Failed to resend OTP. Please try again.",
  networkError: "Network error. Please check your connection.",
  verifyYourNumber: "Verify Your Number",
  weSentOtpTo: "We sent a 6-digit OTP to",
  enterCodeBelow: "Enter the code below to continue",
  verifyAndContinue: "Verify & Continue",
  resendOtpIn: "Resend OTP in {n}s",
  resendOtp: "Resend OTP",
  otpValid10Min: "OTP is valid for 10 minutes",
  home: "Home",
  search: "Search",
  alerts: "Alerts",
  profile: "Profile",
  providerUnavailable: "Provider Unavailable",
  providerNotAcceptingCustomers: "{name} is not currently accepting new customers. Their subscription has expired.",
  ok: "OK",
  seeAll: "See All",
  clear: "Clear",
  allCategories: "All Categories",
  searchBySkillOrService: "Search by skill or service...",
  skilledWorkerFoundNearby: "{n} Skilled Worker Found Nearby",
  skilledWorkersFoundNearby: "{n} Skilled Workers Found Nearby",
  noProvidersInArea: "No providers found in your area. Try a different keyword or category.",
  deleteConversation: "Delete Conversation",
  removeConversationConfirm: "Remove your conversation with {name}? This cannot be undone.",
  delete: "Delete",
  yesterday: "Yesterday",
  today: "Today",
  weekdayMon: "Mon",
  weekdayTue: "Tue",
  weekdayWed: "Wed",
  weekdayThu: "Thu",
  weekdayFri: "Fri",
  weekdaySat: "Sat",
  weekdaySun: "Sun",
  expired: "Expired",
  freeTrial: "Free Trial",
  paidSubscription: "Paid Subscription",
  providerDashboard: "Provider Dashboard",
  provider: "Provider",
  activeSubscription: "Active Subscription",
  expiredOn: "Expired On",
  rechargeRequired: "Recharge Required",
  validUntil: "Valid Until",
  daysRemaining: "{n} Days Remaining",
  subscriptionExpireInDays: "Your subscription will expire in {n} days.",
  subscriptionExpireInDay: "Your subscription will expire in {n} day.",
  renewNowContinue: "Renew now to continue receiving customer enquiries without interruption.",
  completed: "Completed",
  total: "Total",
  thisMonth: "This Month",
  thisWeek: "This Week",
  customerActivity: "Customer Activity",
  calls: "Calls",
  whatsapp: "WhatsApp",
  views: "Views",
  latestReviews: "Latest Reviews",
  seeAllLower: "See all",
  noReviewsYet: "No reviews yet",
  completedJobsEarnRatings: "Completed jobs will earn you ratings from customers.",
  subscription: "Subscription",
  shareProfile: "Share Profile",
  soon: "Soon",
  uploadFailed: "Upload failed",
  couldNotUploadPhotoRetry: "Could not upload photo. Please try again.",
  cameraPermissionRequired: "Camera Permission Required",
  cameraAccessDenied: "Camera access was denied. Please enable it in your device settings.",
  openSettings: "Open Settings",
  permissionNeeded: "Permission needed",
  allowCameraProfilePhoto: "Allow camera access to take a profile photo.",
  allowPhotoLibraryProfile: "Allow access to your photo library to choose a profile photo.",
  takePhoto: "Take Photo",
  chooseFromLibrary: "Choose from Library",
  removePhoto: "Remove Photo",
  changeProfilePhoto: "Change Profile Photo",
  chooseASource: "Choose a source",
  error: "Error",
  couldNotDeleteAccount: "Could not delete account. Please try again or contact support.",
  deleteAccount: "Delete Account",
  deleteAccountConfirm: "This will permanently delete your account and all your data. This cannot be undone. Are you sure?",
  aboutUs: "About Us",
  aboutUsBody: "SkillAd is Tripura's first skill-based marketplace connecting skilled workers with customers across all districts.",
  helpCentre: "Help Centre",
  helpCentreBody: "Need help? Contact us at support@skillad.in or call +91-9999999999. Our support team is available Monday to Saturday, 9 AM to 6 PM.",
  termsOfServiceBody: "By using SkillAd, you agree to our terms of service. Full terms available at skillad.in/terms",
  privacyPolicyBody: "Your privacy matters to us. We collect only essential data for service delivery. Full policy at skillad.in/privacy",
  user: "User",
  availableForWork: "Available for Work",
  unavailable: "Unavailable",
  customersCanDiscover: "Customers can discover and book your services.",
  profileTemporarilyHidden: "Your profile is temporarily hidden from customers.",
  monthly: "Monthly",
  quarterly: "Quarterly",
  halfYearly: "Half Yearly",
  yearly: "Yearly",
  activeDaysLeft: "Active · {n} days left",
  activeDayLeft: "Active · {n} day left",
  noActiveSubscription: "No active subscription",
  expiredRenewToGoLive: "Expired — renew to go live",
  expiringInDays: "Expiring in {n} days",
  expiringInDay: "Expiring in {n} day",
  plan: "Plan",
  expires: "Expires",
  daysRemainingLabel: "Days remaining",
  subscribe: "Subscribe",
  renew: "Renew",
  customerCare: "Customer Care",
  callUsAt: "Call us at {phone}",
  contactCare: "Contact Care",
  editProviderProfile: "Edit Provider Profile",
  accountDetails: "Account Details",
  myDashboard: "My Dashboard",
  earningsBookingsPerformance: "Earnings, bookings and performance",
  detecting: "Detecting...",
  tapToEnableGps: "Tap to enable GPS",
  about: "About",
  appVersion: "SkillAd v1.0.0",
  bookingConfirmed: "Booking Confirmed ✓",
  bookingDeclined: "Booking Declined",
  workDoneAwaiting: "Work Done — Awaiting Confirmation",
  jobConfirmed: "Job Confirmed ✓",
  issueReported: "Issue Reported",
  awaitingConfirmation: "Awaiting confirmation",
  newBookingRequest: "New booking request",
  bookingRequestSent: "Booking Request Sent",
  bookingRequest: "Booking Request",
  amount: "Amount",
  reviewSubmittedCheck: "Review Submitted ✓",
  reviewRequestSent: "Review Request Sent",
  customerHasRated: "Customer has rated your service.",
  waitingForCustomerRating: "Waiting for customer rating",
  reviewSubmitted: "Review Submitted!",
  thankYouFeedback: "Thank you for your feedback.",
  rateFirst: "Rate first",
  selectStarBeforeSubmit: "Please select a star rating before submitting.",
  couldNotSubmitReview: "Could not submit review. Please try again.",
  howWasExperience: "How was your experience?",
  shareYourFeedback: "Share your feedback",
  writeCommentOptional: "Write a comment (optional)",
  submitting: "Submitting…",
  submitReview: "Submit Review",
  workCompleted: "Work Completed",
  customerApprovedEarnings: "Customer approved — earnings recorded",
  customerReportedIssue: "Customer reported an issue",
  awaitingCustomerConfirmation: "Awaiting customer confirmation",
  completionApproved: "Completion Approved ✓",
  paymentReleased: "Payment has been released to the provider",
  resolveWithProvider: "Please resolve with the provider directly",
  providerSaysWorkDone: "Provider says the work is done",
  reportIssue: "Report Issue",
  reportIssueConfirm: "Report that the work was not completed satisfactorily?",
  approveCompletion: "Approve Completion",
  approveCompletionConfirm: "Confirm the work is done? Payment will be released to the provider.",
  approve: "Approve",
  connected: "Connected",
  offlineMode: "Offline mode",
  signInToChat: "Sign in to chat",
  signInToStartMessaging: "Sign in to start messaging",
  sendMessageToStart: "Send a message to start the conversation.",
  createAccountToMessage: "Create an account to send real messages to providers.",
  typeAMessage: "Type a message...",
  signInToMessage: "Sign in to message",
  bookingUnavailable: "Booking Unavailable",
  providerNotAcceptingBookings: "{name} is not currently accepting new bookings. Their subscription has expired.",
  failedToAccept: "Failed to Accept",
  noActiveBooking: "No Active Booking",
  noAcceptedBookingDesc: "There is no accepted booking in this conversation. Accept a booking first.",
  alreadySent: "Already Sent",
  workCompletedAlreadySent: "A Work Completed request has already been sent for this booking. Awaiting customer confirmation.",
  failedToMarkComplete: "Failed to Mark Complete",
  failedToApprove: "Failed to Approve",
  issueNotedContactProvider: "Your issue has been noted. Please contact the provider directly to resolve.",
  declineThisBookingConfirm: "Are you sure you want to decline this booking?",
  failedToDecline: "Failed to Decline",
  deleteMessage: "Delete Message",
  removeThisMessage: "Remove this message?",
  rateReviewAlreadySent: "A Rate & Review request has already been sent for this booking.",
  rateYourExperience: "Rate Your Experience",
  askedYouToRate: "{name} has asked you to rate their service.",
  pleaseRateExperience: "Please rate your service experience.",
  ratingRequestSent: "Rating request sent",
  customerPromptedToRate: "The customer will be prompted to rate their experience.",
  newBookingRequestTitle: "New Booking Request",
  newMessage: "New Message",
  sentBookingRequest: "{name} sent a booking request",
  bookingRequestSentBody: "Your booking request for {service} on {date} at {time} was sent to {name}.",
  bookingSent: "Booking Sent!",
  requestSentToProvider: "Your request for {service} on {date} was sent to {name}.",
  bookingRequestSummary: "Booking request: {service} on {date} at {time} — {amount}",
  wantsToBook: "{name} wants to book {service} on {date} at {time}",
  workCompletedFor: "Work completed for {service}",
  allTime: "All Time",
  earningsChart: "Earnings Chart",
  jobsCompleted: "{n} jobs completed",
  jobCompleted: "{n} job completed",
  noEarningsInPeriod: "No earnings in this period",
  avgPerJob: "Avg per Job",
  bestPeriod: "Best Period",
  jobsDone: "Jobs Done",
  topService: "Top Service",
  fromNJobs: "from {n} jobs",
  thisWeekLower: "this week",
  thisMonthLower: "this month",
  allTimeLower: "all time",
  mostEarned: "most earned",
  byService: "By Service",
  completedJobs: "Completed Jobs",
  noJobsYet: "No jobs yet",
  completedJobsAppearHere: "Completed jobs will appear here with their earnings.",
  pctVsPrev: "{n}% vs prev",
  week1: "Wk 1",
  week2: "Wk 2",
  week3: "Wk 3",
  week4: "Wk 4",
  monthJan: "Jan",
  monthFeb: "Feb",
  monthMar: "Mar",
  monthApr: "Apr",
  monthMay: "May",
  monthJun: "Jun",
  monthJul: "Jul",
  monthAug: "Aug",
  monthSep: "Sep",
  monthOct: "Oct",
  monthNov: "Nov",
  monthDec: "Dec",
  couldNotUploadPhoto: "Could not upload photo.",
  allowCameraTakePhoto: "Allow camera access to take a photo.",
  allowPhotoLibrary: "Allow access to your photo library.",
  nameRequired: "Name required",
  pleaseEnterName: "Please enter your name.",
  saved: "Saved",
  profileUpdated: "Your profile has been updated.",
  couldNotSave: "Could not save. Please try again.",
  save: "Save",
  phoneNumber: "Phone Number",
  locked: "Locked",
  phoneLockedHint: "Phone number is your login credential and cannot be changed.",
  saveChanges: "Save Changes",
  providerNotFound: "Provider not found",
  notSpecified: "Not specified",
  category: "Category",
  specialization: "Specialization",
  newProvider: "New",
  nReviews: "{n} reviews",
  yearsExp: "Years Exp.",
  radius: "Radius",
  location: "Location",
  serviceArea: "Service Area",
  charges: "Charges",
  amountPerVisit: "{amount} per visit",
  status: "Status",
  busy: "Busy",
  reviewsComeFromCustomers: "Reviews come from customers after completing a job",
  editYourProfile: "Edit Your Profile",
  call: "Call",
  inviteHeroSub: "Help your friends discover SkillAd —\nIndia's easiest way to find skilled workers",
  sendInvite: "Send Invite",
  opensShareApps: "Opens WhatsApp, SMS, email and more",
  howItWorks: "How It Works",
  shareTheApp: "Share the App",
  shareAppDesc: "Send the SkillAd link to friends and family via WhatsApp, SMS, or any app.",
  friendSignsUp: "Friend Signs Up",
  friendSignsUpDesc: "Your friend downloads SkillAd and creates their account in minutes.",
  theyreAllSet: "They're All Set",
  theyreAllSetDesc: "Your friend can instantly find skilled workers or list their own services.",
  whyShareSkillAd: "Why Share SkillAd?",
  growCommunity: "Grow the community",
  trustedPlatform: "Trusted platform",
  easyToShare: "Easy to share",
  noInviteLimit: "No invite limit",
  inviteFriendsToSkillAd: "Invite Friends to SkillAd",
  shareMessageLine1: "Hey! I'm using SkillAd to find & hire skilled workers near me.",
  shareMessageLine2: "Find electricians, plumbers, cooks, tutors and more — all verified, all nearby.",
  downloadSkillAdNow: "Download SkillAd now:",
  kmRadius: "{n} km radius",
  workingRadius: "Working Radius",
  workingRadiusHint: "How far are you willing to travel for a job? (minimum 50 km)",
  nKm: "{n} km",
  selectACategory: "Select a category…",
  selectSkillCategory: "Select Skill Category",
  searchCategory: "Search category…",
  noCategoriesFound: "No categories found",
  photoUploadFailed: "Photo upload failed",
  photoUploadFailedDesc: "Could not upload your photo. Your profile will be saved without a photo — you can add one later.",
  pleaseAllowPhotoLibrary: "Please allow access to your photo library.",
  pleaseAllowCamera: "Please allow camera access.",
  uploadPhoto: "Upload Photo",
  chooseHowAddPhoto: "Choose how to add your profile photo",
  pleaseEnterDisplayName: "Please enter your display name",
  pleaseSelectSkillCategory: "Please select a skill category",
  pleaseEnterExperience: "Please enter your years of experience",
  atLeast20Chars: "At least 20 characters needed ({n}/20)",
  profileUpdatedTitle: "Profile Updated",
  providerProfileSaved: "Your provider profile has been saved.",
  updateSkillsProfile: "Update your skills and profile information",
  showcaseSkillsGetHired: "Showcase your skills and get hired by customers nearby",
  displayName: "Display Name",
  displayNamePlaceholder: "Your name as customers will see it",
  serviceLocation: "Service Location",
  serviceLocationPlaceholder: "e.g. Camper Bazar, Agartala",
  typeOrUseGps: "Type your service area or tap to use GPS",
  skillCategory: "Skill Category",
  subcategorySpecialization: "Subcategory / Specialization",
  subcategoryPlaceholder: "e.g. AC Installation, Bridal Makeup…",
  yearsOfExperience: "Years of Experience",
  yearsExperiencePlaceholder: "e.g. 5",
  servicesOffered: "Services Offered (comma-separated)",
  servicesOfferedPlaceholder: "e.g. Wiring, AC Install, CCTV",
  serviceDescription: "Service Description",
  serviceDescriptionPlaceholder: "Describe your services and what makes you stand out…",
  profileColor: "Profile Color",
  serviceAreaPlaceholder: "e.g. Agartala Municipal Corporation, Mohanpur, Bishalgarh",
  serviceChargeOptional: "Service Charge (optional)",
  serviceChargePlaceholder: "e.g. ₹300–₹800 per visit",
  profilePhoto: "Profile Photo",
  uploadingPhoto: "Uploading photo…",
  photoAdded: "Photo Added",
  addProfilePhoto: "Add a profile photo",
  photoHintEdit: "A clear face photo helps customers identify and trust your profile.",
  photoHintNew: "A clear face photo helps customers trust you. Tap to take or choose a photo.",
  submitRegistration: "Submit Registration",
  billedEveryMonth: "Billed every month",
  billedEvery3Months: "Billed every 3 months",
  billedEvery6Months: "Billed every 6 months",
  billedOnceAYear: "Billed once a year",
  popular: "Popular",
  bestValue: "Best Value",
  featureAppearInSearch: "Appear in customer search results",
  featureLocationMatching: "Location-based job matching",
  featureUnlimitedMessaging: "Unlimited customer messaging",
  featureInstantBookingNotifs: "Instant booking notifications",
  featureCollectRatings: "Collect ratings & reviews",
  featureEarningsAnalytics: "Earnings analytics dashboard",
  featureVerifiedBadge: "Verified provider badge",
  upi: "UPI",
  debitCreditCard: "Debit/Credit Card",
  netBanking: "Net Banking",
  mobileWallet: "Mobile Wallet",
  upiDesc: "GPay, PhonePe, Paytm, BHIM",
  cardDesc: "Visa, Mastercard, RuPay",
  netBankingDesc: "All major Indian banks",
  walletDesc: "Paytm, Mobikwik, Freecharge",
  paymentSuccessful: "Payment Successful!",
  subscriptionNowActive: "Your {name} subscription is now active.",
  startEarning: "Start Earning",
  accountInactive: "Account Inactive",
  accountInactiveDesc: "Your provider profile has been saved but won't appear in customer searches until you activate a subscription. You can subscribe anytime from your Profile.",
  continueLabel: "Continue",
  required: "Required",
  pleaseEnterUtr: "Please enter your UTR / Transaction ID.",
  notSignedIn: "Not signed in",
  pleaseSignInFirst: "Please sign in first.",
  couldNotSubmitRenewal: "Could not submit your renewal request. Please try again.",
  subscriptionActivated: "Subscription Activated!",
  requestRejected: "Request Rejected",
  clarificationNeeded: "Clarification Needed",
  requestSubmitted: "Request Submitted!",
  subscriptionActiveDesc: "Your subscription is now active. You will appear in customer searches and can receive bookings.",
  paymentNotVerified: "Your payment could not be verified. Please contact support or submit again.",
  adminRequestedInfo: "The admin has requested more information about your payment.",
  renewalSubmittedDesc: "Your renewal request has been submitted. Our team will review your payment within 24 hours and activate your subscription.",
  utrTxnId: "UTR / Txn ID",
  paymentDate: "Payment Date",
  pendingReview: "Pending Review",
  submitAgain: "Submit Again",
  goToApp: "Go to App",
  continueToApp: "Continue to App",
  activateYourSubscription: "Activate Your Subscription",
  activateSubscriptionSub: "Complete your subscription to continue offering your services and receive customer bookings.",
  whatsIncluded: "What's Included",
  paymentMethod: "Payment Method",
  orderSummary: "Order Summary",
  skillAdProPlan: "SkillAd Pro ({name})",
  subtotal: "Subtotal",
  gst18: "GST (18%)",
  payAmountSecurely: "Pay ₹{amount} Securely",
  securedBySsl: "Secured by 256-bit SSL encryption · Cancel anytime",
  skipActivateLater: "Skip for now — activate later",
  whereToPay: "Where to Pay",
  upiPayment: "UPI Payment",
  upiApps: "PhonePe · GPay · Paytm · BHIM",
  upiId: "UPI ID",
  name: "Name",
  bankTransfer: "Bank Transfer",
  neftImpsRtgs: "NEFT / IMPS / RTGS",
  bank: "Bank",
  accountNo: "Account No.",
  ifsc: "IFSC",
  branch: "Branch",
  paymentDetailsBeingSetUp: "Payment details are being set up. Please contact support to complete your subscription.",
  paymentSummary: "Payment Summary",
  planLabel: "{name} Plan",
  submitPaymentDetails: "Submit Payment Details",
  utrTransactionId: "UTR / Transaction ID",
  utrPlaceholder: "e.g. 406123456789",
  utrHint: "12-digit UTR for NEFT/IMPS or UPI reference number",
  dateFormatPlaceholder: "YYYY-MM-DD",
  amountPaid: "Amount Paid (₹)",
  notesOptional: "Notes (optional)",
  notesPlaceholder: "Anything the admin should know…",
  submitForVerification: "Submit for Verification",
  requestReviewed24h: "Your request will be reviewed within 24 hours. You'll receive a notification once approved.",
  skipActivateLaterFromProfile: "Skip for now — activate later from Profile",
  chooseYourPlan: "Choose Your Plan",
  oops: "Oops!",
  screenDoesntExist: "This screen doesn't exist.",
  goToHomeScreen: "Go to home screen!",
  back: "Back",
  providerDetails: "Provider Details",
  toBeConfirmed: "To be confirmed",
  tomorrow: "Tomorrow",
  requestBooking: "Request Booking",
  withName: "with {name}",
  dateAndTime: "Date & Time",
  confirm: "Confirm",
  whatServiceNeed: "What service do you need?",
  other: "Other",
  describeServiceNeed: "Describe the service you need...",
  budgetOptional: "Budget (optional)",
  enterBudgetOrBlank: "Enter your budget or leave blank",
  selectADate: "Select a date",
  selectATime: "Select a time",
  bookingSummary: "Booking Summary",
  reviewBeforeSending: "Review before sending",
  addNoteOptional: "Add a note for the provider (optional)...",
  bookingRequestNote: "This sends a booking request card in the chat. The provider will confirm the appointment.",
  nextDateTime: "Next: Date & Time",
  reviewBooking: "Review Booking",
  sendBookingRequest: "Send Booking Request",
  time800am: "8:00 AM",
  time900am: "9:00 AM",
  time1000am: "10:00 AM",
  time1100am: "11:00 AM",
  time1200pm: "12:00 PM",
  time100pm: "1:00 PM",
  time200pm: "2:00 PM",
  time300pm: "3:00 PM",
  time400pm: "4:00 PM",
  time500pm: "5:00 PM",
  time600pm: "6:00 PM",
  time700pm: "7:00 PM",
  pleaseSelectStarRating: "Please select a star rating.",
  mustSignInToReview: "You must be signed in with a real account to leave a review.",
  failedToSubmitReview: "Failed to submit review. Please try again.",
  ratingPoor: "Poor",
  ratingFair: "Fair",
  ratingGood: "Good",
  ratingGreat: "Great",
  ratingExcellent: "Excellent",
  rateName: "Rate {name}",
  howWasExperienceHelp: "How was your experience? Your honest feedback helps others.",
  shareDetailsOptional: "Share details about your experience (optional)...",
  thanksForSharing: "Thanks for sharing your experience with {name}.",
  reviewsRequireAccount: "Note: Reviews require a verified Supabase account (not demo mode).",
  you: "You",
  kmAway: "{n} km away",
  findSkilledWorkersNearYou: "Find Skilled Workers Near You",
  uploadFirstAd: "Upload your first ad from the Admin Panel",
  contentNotAvailable: "Content not available yet. Please check back later.",
  somethingWentWrong: "Something went wrong",
  pleaseReloadApp: "Please reload the app to continue.",
  tryAgain: "Try Again",
  errorDetails: "Error Details",
  stayUpdatedBookings: "Stay updated with your bookings and activities.",
  addPhoto: "Add Photo",
  viewErrorDetails: "View error details",
  closeErrorDetails: "Close error details",
  anonymous: "Anonymous",
  failedToSubmit: "Failed to submit",
};

function withExtraStrings(core: CoreStrings): Strings {
  return { ...core, ...EXTRA_STRINGS };
}

const translations: Record<AppLanguage, Strings> = {
  English: withExtraStrings(bundledTranslations.English),
  Assamese: withExtraStrings(bundledTranslations.Assamese),
  Bengali: withExtraStrings(bundledTranslations.Bengali),
  Bodo: withExtraStrings(bundledTranslations.Bodo),
  Dogri: withExtraStrings(bundledTranslations.Dogri),
  Gujarati: withExtraStrings(bundledTranslations.Gujarati),
  Hindi: withExtraStrings(bundledTranslations.Hindi),
  Kannada: withExtraStrings(bundledTranslations.Kannada),
  Kashmiri: withExtraStrings(bundledTranslations.Kashmiri),
  Kokborok: withExtraStrings(bundledTranslations.Kokborok),
  Konkani: withExtraStrings(bundledTranslations.Konkani),
  Maithili: withExtraStrings(bundledTranslations.Maithili),
  Malayalam: withExtraStrings(bundledTranslations.Malayalam),
  Manipuri: withExtraStrings(bundledTranslations.Manipuri),
  Marathi: withExtraStrings(bundledTranslations.Marathi),
  Nepali: withExtraStrings(bundledTranslations.Nepali),
  Odia: withExtraStrings(bundledTranslations.Odia),
  Punjabi: withExtraStrings(bundledTranslations.Punjabi),
  Sanskrit: withExtraStrings(bundledTranslations.Sanskrit),
  Santali: withExtraStrings(bundledTranslations.Santali),
  Sindhi: withExtraStrings(bundledTranslations.Sindhi),
  Tamil: withExtraStrings(bundledTranslations.Tamil),
  Telugu: withExtraStrings(bundledTranslations.Telugu),
  Urdu: withExtraStrings(bundledTranslations.Urdu),
};



type LanguageContextType = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: Strings;
  translate: (key: string) => string;
  enabledLanguages: AppLanguage[];
};

const STORAGE_KEY = "@skilladd_language";
const DYN_CACHE_PREFIX = "@skilladd_dyn_trans_";
const DYN_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const DEFAULT_ENABLED: AppLanguage[] = ["English", "Bengali", "Hindi", "Kokborok", "Manipuri"];
// API_BASE is imported from lib/db — always resolves to production or dev correctly

const LanguageContext = createContext<LanguageContextType>({
  language: "English",
  setLanguage: async () => {},
  t: translations.English,
  translate: (key: string) => key,
  enabledLanguages: DEFAULT_ENABLED,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<AppLanguage>("English");
  const [enabledLanguages, setEnabledLanguages] = useState<AppLanguage[]>(DEFAULT_ENABLED);
  // Dynamic overrides loaded from API — overlay on top of hardcoded translations
  const [dynamicOverrides, setDynamicOverrides] = useState<Record<string, string>>({});

  // Fetch dynamic translations for a given language from the API.
  // Tries AsyncStorage cache first (TTL 1 hour), then network.
  async function fetchDynamicTranslations(lang: AppLanguage) {
    const cacheKey = `${DYN_CACHE_PREFIX}${lang}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { ts: number; data: Record<string, string> };
        if (Date.now() - parsed.ts < DYN_CACHE_TTL) {
          setDynamicOverrides(parsed.data);
          return;
        }
      }
    } catch { /* cache miss — fetch from network */ }

    try {
      const r = await fetch(`${API_BASE}/translations/${encodeURIComponent(lang)}`);
      if (r.ok) {
        const data = await r.json() as Record<string, string>;
        // Only cache and apply if server returned actual translations (not empty)
        if (Object.keys(data).length > 0) {
          setDynamicOverrides(data);
          await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
        }
      }
    } catch { /* non-fatal — hardcoded translations remain active */ }
  }

  useEffect(() => {
    // Load from AsyncStorage first (instant)
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && stored in translations) {
        setLang(stored as AppLanguage);
        void fetchDynamicTranslations(stored as AppLanguage);
      } else {
        void fetchDynamicTranslations("English");
      }
    });

    // Then check Supabase for the canonical saved language preference
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data } = await supabase
          .from("profiles")
          .select("language")
          .eq("id", session.user.id)
          .single() as { data: { language?: string } | null };
        if (data?.language && data.language in translations) {
          setLang(data.language as AppLanguage);
          void AsyncStorage.setItem(STORAGE_KEY, data.language);
          void fetchDynamicTranslations(data.language as AppLanguage);
        }
      } catch {
        // Non-fatal
      }
    })();

    // Fetch enabled languages from admin settings
    fetch(`${API_BASE}/settings`)
      .then((r) => r.json())
      .then((d: any) => {
        if (Array.isArray(d.enabledLanguages) && d.enabledLanguages.length > 0) {
          const valid = d.enabledLanguages.filter((l: string) => l in translations) as AppLanguage[];
          if (!valid.includes("English")) valid.unshift("English");
          setEnabledLanguages(valid);
          setLang((cur) => valid.includes(cur) ? cur : "English");
        }
      })
      .catch(() => {});
  }, []);

  async function setLanguage(lang: AppLanguage) {
    setLang(lang);
    setDynamicOverrides({}); // clear stale overrides immediately
    await AsyncStorage.setItem(STORAGE_KEY, lang);
    void fetchDynamicTranslations(lang);
    // Also persist to Supabase profile so it syncs across devices
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("profiles").update({ language: lang }).eq("id", session.user.id);
      }
    } catch {
      // Non-fatal — column may not exist in Supabase schema yet
    }
  }

  // Merge dynamic overrides on top of hardcoded translations.
  // Existing t.key access continues to work and picks up admin overrides automatically.
  const effectiveT = { ...translations[language], ...dynamicOverrides } as Strings;

  // translate(key) — for accessing dynamic-only keys or as a function-call alternative.
  // Priority: dynamic override → current language hardcoded → English hardcoded → raw key
  function translate(key: string): string {
    if (dynamicOverrides[key]) return dynamicOverrides[key];
    const langMap = translations[language] as unknown as Record<string, string>;
    if (langMap[key]) return langMap[key];
    const enMap = translations.English as unknown as Record<string, string>;
    if (enMap[key]) return enMap[key];
    return key;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: effectiveT, translate, enabledLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
