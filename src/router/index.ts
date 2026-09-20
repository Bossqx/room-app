import { createRouter, createWebHistory } from "vue-router";

const DisplayView = () => import("../views/DisplayView.vue");
const ConfirmSchedule = () => import("../views/confirmSchedule.vue");
const SelfConfirmSchedule = () => import("../views/SelfConfirm.vue");
const Login = () => import("../views/Login.vue");
const BookingSchedule = () => import("../views/BookingScheduleV1.vue");
const ScheduleDesktopV1 = () => import("../views/ScheduleDesktopV1.vue");
const DisplayEmptyRoomsV1 = () => import("../views/DisplayEmptyRoomV1.vue");
const Booking = () => import("../views/Booking.vue");
const StaffAccess = () => import("../views/StaffAccess.vue");
const StaffSumitClose = () => import("../views/StaffSumitClose.vue");
const SubmitClose = StaffSumitClose;
const UserLayoute = () => import("../layouts/UserLayoute.vue");
const PCLayoute = () => import("../layouts/PCLayoute.vue");
const GeneralLayout = () => import("../layouts/GeneralLayout.vue");
const SetFrameLayout = () => import("../layouts/SetFrameLayout.vue");
const ChangePin = () => import("../views/ChangePin.vue");
const AdminLayout = () => import("../layouts/AdminLayoute.vue");
const AdminMigration = () => import("../views/AdminMigration.vue");
const SemesterManage = () => import("../views/SemesterManage.vue");
const AdminManageSchedule = () => import("../views/AdminManageSchedule.vue");
const Dashboard = () => import("../views/dashboard.vue");
const ScheduleAll = () => import("../views/ScheduleAll.vue");
const ScheduleDashboard = () => import("../views/ScheduleDashboard.vue");
const ScheduleInfo = () => import("../views/ScheduleInfo.vue");
const InformationDashboard = () => import("../views/InformationDashboard.vue");
const InformationMobile = () => import("../views/InformationMobile.vue");
const RoomAdmin = () => import("../views/RoomAdmin.vue");
const AdminCancelRoom = () => import("../views/AdminCancelRoom.vue");
const DashboardTestLayout = () => import("../layouts/DashboardTestLayout.vue");
const DashboardTest = () => import("../views/DashboardTest.vue");

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/qr-front", name: "display", component: DisplayView },
    { path: "/confirm", name: "confirm", component: ConfirmSchedule },
    { path: "/staff-access", name: "staff-access", component: StaffAccess },
    { path: "/login", name: "login", component: Login },
    {
      path: "/staff-close",
      component: SetFrameLayout,
      children: [{ path: "", name: "staff-close", component: StaffSumitClose }],
    },
    {
      path: "/submit-close",
      component: SetFrameLayout,
      children: [{ path: "", name: "submit-close", component: SubmitClose }],
    },
    {
      path: "/",
      component: GeneralLayout,
      children: [
        { path: "", redirect: "/dashboard-first" },
        {
          path: "dashboard-first",
          name: "dashboard-first",
          component: InformationDashboard,
        },
      ],
    },
    {
      path: "/dashboard-test",
      component: DashboardTestLayout,
      children: [
        { path: "", name: "dashboard-test", component: DashboardTest },
      ],
    },

    {
      path: "/",
      component: UserLayoute,
      children: [
        { path: "", redirect: "/login" },
        {
          path: "mobile/schedule",
          name: "mobile/schedule",
          component: BookingSchedule,
        },
        {
          path: "mobile/empty-rooms",
          name: "mobile/empty-rooms",
          component: DisplayEmptyRoomsV1,
        },
        { path: "mobile/booking", name: "mobile/booking", component: Booking },
        { path: "mobile/home", name: "mobile/home", component: InformationMobile },
        {
          path: "self-confirm",
          name: "self-confirm",
          component: SelfConfirmSchedule,
        },
        {
          path: "/mobile/change-pin",
          name: "/mobile/change-pin",
          component: ChangePin,
        },
      ],
    },
    {
      path: "/desktop",
      component: PCLayoute,
      children: [
        {
          path: "/desktop/schedule",
          name: "/desktop/schedule",
          component: ScheduleDesktopV1,
        },
        {
          path: "/desktop/home",
          name: "/desktop/home",
          component: ScheduleAll,
        },
        {
          path: "/desktop/room-summary",
          name: "/desktop/room-summary",
          component: ScheduleDashboard,
        },
        {
          path: "/desktop/schedule-info",
          name: "/desktop/schedule-info",
          component: ScheduleInfo,
        },
        {
          path: "/desktop/overview",
          name: "/desktop/overview",
          component: InformationDashboard,
        },
      ],
    },

    {
      path: "/admin",
      component: AdminLayout,
      children: [
        { path: "/admin/home", name: "/admin/home", component: AdminMigration },
        {
          path: "/admin/semester",
          name: "/admin/semester",
          component: SemesterManage,
        },
        {
          path: "/admin/schedule",
          name: "/admin/schedule",
          component: AdminManageSchedule,
        },
        {
          path: "/admin/rooms",
          name: "/admin/rooms",
          component: RoomAdmin,
        },
        {
          path: "/admin/cancel-room",
          name: "/admin/cancel-room",
          component: AdminCancelRoom,
        },
      ],
    },
    {
      path: "/dashboard",
      component: AdminLayout,
      children: [
        { path: "/dashboard", name: "/dashboard", component: Dashboard },
      ],
    },
  ],
});

export default router;
