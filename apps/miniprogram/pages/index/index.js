const api = require("../../services/api");
const { getToken, setToken } = require("../../services/http");
const { getTodayDate, monthOfDate, shiftMonth, listMonthGrid } = require("../../utils/date");

const TASK_MODAL_ANIM_DURATION = 160;
const TASK_MODAL_CLOSE_DELAY = TASK_MODAL_ANIM_DURATION + 20;
const TODO_SWIPE_DELETE_WIDTH_RPX = 156;
const TASK_SWIPE_ACTION_WIDTH_RPX = 312;
const SWIPE_DIRECTION_LOCK_DISTANCE_PX = 8;
const SWIPE_OPEN_THRESHOLD_RATIO = 0.4;
const SWIPE_RIGHT_PULL_PX = 12;
const VIEW_SWITCH_THRESHOLD_PX = 28;
const REPEAT_WEEKDAY_OPTIONS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 7, label: "周日" },
];

function normalizeRepeatWeekdays(weekdays = []) {
  return [...new Set((weekdays || []).map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 1 && item <= 7))].sort(
    (a, b) => a - b
  );
}

function buildRepeatWeekdayOptions(selectedWeekdays = []) {
  const selectedSet = new Set(normalizeRepeatWeekdays(selectedWeekdays));
  return REPEAT_WEEKDAY_OPTIONS.map((item) => ({
    ...item,
    selected: selectedSet.has(item.value),
  }));
}

function defaultTaskForm(today) {
  return {
    title: "",
    remark: "",
    tagId: "",
    tagName: "",
    effectiveStartDate: today,
    effectiveEndDate: "",
    repeatWeekdays: [],
  };
}

function normalizeTagOptions(list = []) {
  return (list || [])
    .filter((item) => item && item.tagId && item.tagName)
    .map((item) => ({
      tagId: String(item.tagId),
      tagName: String(item.tagName),
      sort: Number(item.sort) || 0,
    }));
}

function findTagIndex(options, tagId) {
  if (!tagId) {
    return -1;
  }
  return options.findIndex((item) => item.tagId === tagId);
}

function formatTaskDateRange(task) {
  const start = task.effectiveStartDate || "";
  const end = task.effectiveEndDate || "长期有效";
  if (!start) {
    return end;
  }
  return `${start} ~ ${end}`;
}

function normalizeTaskList(list = []) {
  return (list || []).map((item) => ({
    ...item,
    dateRangeText: formatTaskDateRange(item),
  }));
}

Page({
  data: {
    ready: false,
    loading: false,
    errorText: "",
    today: "",
    currentMonth: "",
    selectedDate: "",
    calendarCells: [],
    dayStatusMap: {},
    currentView: "todo",
    todos: [],
    tasks: [],
    taskListLoading: false,
    taskListLoaded: false,
    completedCount: 0,
    uncompletedCount: 0,
    total: 0,
    progressPercent: 0,
    taskModalVisible: false,
    taskModalMode: "create",
    editingTaskId: "",
    taskForm: {},
    taskModalSaving: false,
    taskModalClosing: false,
    taskModalAnimation: null,
    taskTitleFocus: false,
    tagOptions: [],
    tagLoading: false,
    taskTagIndex: -1,
    repeatWeekdayOptions: buildRepeatWeekdayOptions([]),
    statusBarHeight: 0,
    navBarHeight: 44,
    todoSwipeDeleteWidthPx: 0,
    taskSwipeActionWidthPx: 0,
    openedTodoId: "",
    movingTodoId: "",
    movingOffset: 0,
    openedTaskId: "",
    movingTaskId: "",
    movingTaskOffset: 0,
    todayCompensatedDate: "",
  },

  async onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const menuBtn = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sysInfo.statusBarHeight;
    const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    const todoSwipeDeleteWidthPx = Math.round((TODO_SWIPE_DELETE_WIDTH_RPX / 750) * sysInfo.windowWidth);
    const taskSwipeActionWidthPx = Math.round((TASK_SWIPE_ACTION_WIDTH_RPX / 750) * sysInfo.windowWidth);
    const today = getTodayDate();
    const currentMonth = monthOfDate(today);
    const initialCalendarCells = listMonthGrid(currentMonth, today, today, {});
    this.setData({
      statusBarHeight,
      navBarHeight,
      todoSwipeDeleteWidthPx,
      taskSwipeActionWidthPx,
      today,
      selectedDate: today,
      currentMonth,
      calendarCells: initialCalendarCells,
      taskForm: defaultTaskForm(today),
    });
    await this.bootstrap();
  },

  onUnload() {
    if (this._taskModalCloseTimer) {
      clearTimeout(this._taskModalCloseTimer);
      this._taskModalCloseTimer = null;
    }
    this._todoSwipeGesture = null;
    this._taskSwipeGesture = null;
    this._viewSwitchGesture = null;
    this._taskTapGuard = null;
  },

  async onPullDownRefresh() {
    this.closeOpenedTodoSwipe();
    this.closeOpenedTaskSwipe();
    if (this.data.currentView === "task") {
      await this.loadTasks(true);
    } else {
      await this.loadPageData();
    }
    wx.stopPullDownRefresh();
  },

  async bootstrap() {
    this.setData({ loading: true, errorText: "" });
    try {
      await this.ensureLogin();
      await this.loadPageData();
      this.setData({ ready: true });
    } catch (err) {
      this.setData({
        errorText: err.message || "初始化失败，请重试",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async ensureLogin() {
    if (getToken()) {
      return;
    }
    const loginData = await api.login();
    setToken(loginData.token);
    getApp().globalData.token = loginData.token;
  },

  async ensureTodayCompensated() {
    const { today, selectedDate, todayCompensatedDate } = this.data;
    if (!today || selectedDate !== today || todayCompensatedDate === today || this._compensateTodayLoading) {
      return;
    }
    this._compensateTodayLoading = true;
    try {
      await api.compensateTodayTodos();
      this.setData({
        todayCompensatedDate: today,
      });
    } catch (err) {
      console.warn("当日补偿调用失败", err && err.message ? err.message : err);
    } finally {
      this._compensateTodayLoading = false;
    }
  },

  async loadPageData() {
    this.setData({ loading: true, errorText: "" });
    try {
      await this.ensureTodayCompensated();
      await Promise.all([this.loadCalendar(), this.loadTodos()]);
    } catch (err) {
      this.setData({
        errorText: err.message || "加载失败",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadCalendar() {
    const { currentMonth, selectedDate, today } = this.data;
    const data = await api.getMonthCalendar(currentMonth);
    const dayStatusMap = {};
    (data.days || []).forEach((day) => {
      dayStatusMap[day.date] = day.status;
    });
    const cells = listMonthGrid(currentMonth, selectedDate, today, dayStatusMap);
    this.setData({
      dayStatusMap,
      calendarCells: cells,
    });
  },

  async loadTodos() {
    const { selectedDate } = this.data;
    const data = await api.getTodos(selectedDate);
    const completed = data.completedCount || 0;
    const total = data.total || 0;
    this.setData({
      todos: data.list || [],
      completedCount: completed,
      uncompletedCount: data.uncompletedCount || 0,
      total,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      openedTodoId: "",
      movingTodoId: "",
      movingOffset: 0,
    });
  },

  async loadTasks(force = false) {
    if (!force && this.data.taskListLoaded) {
      return;
    }
    this.setData({ taskListLoading: true });
    try {
      const data = await api.getTasks(1, 100);
      this.setData({
        tasks: normalizeTaskList(data.list || []),
        taskListLoaded: true,
        openedTaskId: "",
        movingTaskId: "",
        movingTaskOffset: 0,
      });
    } catch (err) {
      this.showPageToast({
        text: err.message || "任务列表加载失败",
        type: "error",
        key: "task_list_load_error",
      });
    } finally {
      this.setData({ taskListLoading: false });
    }
  },

  async switchView(nextView) {
    if (nextView !== "todo" && nextView !== "task") {
      return;
    }
    if (this.data.currentView === nextView) {
      return;
    }
    this.setData({
      currentView: nextView,
    });
    this.closeOpenedTodoSwipe();
    this.closeOpenedTaskSwipe();
    if (nextView === "task") {
      await this.loadTasks();
    }
  },

  onSwitchView(e) {
    const { view } = e.currentTarget.dataset;
    this.switchView(view).catch(() => {});
  },

  onViewSwitchTouchStart(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) {
      return;
    }
    this._viewSwitchGesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      lockDirection: "pending",
      deltaX: 0,
    };
  },

  onViewSwitchTouchMove(e) {
    const gesture = this._viewSwitchGesture;
    if (!gesture) {
      return;
    }
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) {
      return;
    }
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    if (gesture.lockDirection === "pending") {
      if (Math.abs(deltaX) < SWIPE_DIRECTION_LOCK_DISTANCE_PX && Math.abs(deltaY) < SWIPE_DIRECTION_LOCK_DISTANCE_PX) {
        return;
      }
      gesture.lockDirection = Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (gesture.lockDirection !== "horizontal") {
      return;
    }
    gesture.deltaX = deltaX;
  },

  onViewSwitchTouchEnd() {
    const gesture = this._viewSwitchGesture;
    this._viewSwitchGesture = null;
    if (!gesture || gesture.lockDirection !== "horizontal") {
      return;
    }
    if (Math.abs(gesture.deltaX) < VIEW_SWITCH_THRESHOLD_PX) {
      return;
    }
    if (gesture.deltaX > 0) {
      this.switchView("todo").catch(() => {});
    } else {
      this.switchView("task").catch(() => {});
    }
  },

  onViewSwitchTouchCancel() {
    this._viewSwitchGesture = null;
  },

  async onMonthShift(e) {
    const delta = Number(e.currentTarget.dataset.delta || 0);
    const nextMonth = shiftMonth(this.data.currentMonth, delta);
    this.setData({
      currentMonth: nextMonth,
    });
    this.closeOpenedTodoSwipe();
    this.closeOpenedTaskSwipe();
    await this.loadCalendar();
  },

  async onSelectDate(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    const { currentMonth, today, dayStatusMap } = this.data;
    const cells = listMonthGrid(currentMonth, date, today, dayStatusMap);
    this.setData({
      selectedDate: date,
      calendarCells: cells,
    });
    this.closeOpenedTodoSwipe();
    this.closeOpenedTaskSwipe();
    await this.loadTodos();
  },

  closeOpenedTodoSwipe() {
    if (!this.data.openedTodoId && !this.data.movingTodoId && this.data.movingOffset === 0) {
      return;
    }
    this.setData({
      openedTodoId: "",
      movingTodoId: "",
      movingOffset: 0,
    });
  },

  closeOpenedTaskSwipe() {
    if (!this.data.openedTaskId && !this.data.movingTaskId && this.data.movingTaskOffset === 0) {
      return;
    }
    this.setData({
      openedTaskId: "",
      movingTaskId: "",
      movingTaskOffset: 0,
    });
  },

  showPageToast(options = {}) {
    const app = getApp();
    if (app && app.uiToast && typeof app.uiToast.show === "function") {
      const shown = app.uiToast.show(this, options);
      if (shown) {
        return;
      }
    }
    wx.showToast({
      title: options.text || "",
      icon: "none",
    });
  },

  onOpenMenuDrawer() {
    this.closeOpenedTodoSwipe();
    this.closeOpenedTaskSwipe();
    wx.navigateTo({
      url: "/pages/menu/index",
      fail: () => {
        this.showPageToast({
          text: "菜单打开失败",
          type: "error",
          key: "menu_open_error",
        });
      },
    });
  },

  onTodoTouchStart(e) {
    const { todoId } = e.currentTarget.dataset;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!todoId || !touch) {
      return;
    }

    const { openedTodoId, todoSwipeDeleteWidthPx } = this.data;
    if (openedTodoId && openedTodoId !== todoId) {
      this.closeOpenedTodoSwipe();
    }

    this._todoSwipeGesture = {
      todoId,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffset: openedTodoId === todoId ? -todoSwipeDeleteWidthPx : 0,
      lockDirection: "pending",
      lastOffset: openedTodoId === todoId ? -todoSwipeDeleteWidthPx : 0,
    };
  },

  onTodoTouchMove(e) {
    const gesture = this._todoSwipeGesture;
    if (!gesture) {
      return;
    }
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    if (gesture.lockDirection === "pending") {
      if (Math.abs(deltaX) < SWIPE_DIRECTION_LOCK_DISTANCE_PX && Math.abs(deltaY) < SWIPE_DIRECTION_LOCK_DISTANCE_PX) {
        return;
      }
      gesture.lockDirection = Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (gesture.lockDirection !== "horizontal") {
      return;
    }

    const minOffset = -this.data.todoSwipeDeleteWidthPx;
    const maxOffset = gesture.startOffset < 0 ? SWIPE_RIGHT_PULL_PX : 0;
    let nextOffset = gesture.startOffset + deltaX;
    if (nextOffset < minOffset) {
      nextOffset = minOffset;
    }
    if (nextOffset > maxOffset) {
      nextOffset = maxOffset;
    }
    if (nextOffset === gesture.lastOffset) {
      return;
    }

    gesture.lastOffset = nextOffset;
    this.setData({
      movingTodoId: gesture.todoId,
      movingOffset: nextOffset,
    });
  },

  onTodoTouchEnd() {
    const gesture = this._todoSwipeGesture;
    if (!gesture) {
      return;
    }
    this._todoSwipeGesture = null;

    if (gesture.lockDirection === "vertical") {
      this.setData({
        movingTodoId: "",
        movingOffset: 0,
      });
      return;
    }

    const openThreshold = -this.data.todoSwipeDeleteWidthPx * SWIPE_OPEN_THRESHOLD_RATIO;
    const shouldOpen = gesture.lastOffset <= openThreshold;
    this.setData({
      openedTodoId: shouldOpen ? gesture.todoId : "",
      movingTodoId: "",
      movingOffset: 0,
    });
  },

  onTodoTouchCancel() {
    this.onTodoTouchEnd();
  },

  onTodoCardTap(e) {
    const { todoId } = e.currentTarget.dataset;
    if (this.data.openedTodoId && this.data.openedTodoId === todoId) {
      this.closeOpenedTodoSwipe();
    }
  },

  async onToggleTodoStatus(e) {
    const { todoId, status } = e.currentTarget.dataset;
    if (!todoId) return;
    if (this.data.openedTodoId === todoId) {
      this.closeOpenedTodoSwipe();
      return;
    }
    const currentStatus = Number(status || 1);
    const nextStatus = currentStatus === 2 ? 1 : 2;

    // 快照：用于失败回滚
    const prevTodos = this.data.todos;
    const prevCompleted = this.data.completedCount;
    const prevUncompleted = this.data.uncompletedCount;
    const prevTotal = this.data.total;
    const prevPercent = this.data.progressPercent;

    // 乐观更新：立即刷新 UI
    const newTodos = prevTodos.map((t) =>
      t._id === todoId ? { ...t, status: nextStatus } : t
    );
    const delta = nextStatus === 2 ? 1 : -1;
    const newCompleted = prevCompleted + delta;
    const newUncompleted = prevUncompleted - delta;
    this.setData({
      todos: newTodos,
      completedCount: newCompleted,
      uncompletedCount: newUncompleted,
      progressPercent: prevTotal > 0 ? Math.round((newCompleted / prevTotal) * 100) : 0,
    });

    try {
      await api.updateTodoStatus(todoId, nextStatus);
      // 静默刷新：同步服务端最新数据
      Promise.all([this.loadTodos(), this.loadCalendar()]).catch(() => {});
    } catch (err) {
      // 回滚
      this.setData({
        todos: prevTodos,
        completedCount: prevCompleted,
        uncompletedCount: prevUncompleted,
        progressPercent: prevPercent,
      });
      wx.showToast({
        title: "操作失败",
        icon: "none",
      });
    }
  },

  async onDeleteTodo(e) {
    const { todoId } = e.currentTarget.dataset;
    if (!todoId) {
      return;
    }
    try {
      await api.deleteTodo(todoId);
      this.closeOpenedTodoSwipe();
      this.showPageToast({
        text: "删除成功",
        type: "success",
        key: "todo_delete_success",
      });
      await Promise.all([this.loadTodos(), this.loadCalendar()]);
    } catch (err) {
      this.showPageToast({
        text: err.message || "删除失败",
        type: "error",
        key: `todo_delete_error:${err.message || "删除失败"}`,
      });
    }
  },

  onTaskTouchStart(e) {
    const { taskId } = e.currentTarget.dataset;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!taskId || !touch) {
      return;
    }

    const { openedTaskId, taskSwipeActionWidthPx } = this.data;
    if (openedTaskId && openedTaskId !== taskId) {
      this.closeOpenedTaskSwipe();
    }

    this._taskSwipeGesture = {
      taskId,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffset: openedTaskId === taskId ? -taskSwipeActionWidthPx : 0,
      lockDirection: "pending",
      lastOffset: openedTaskId === taskId ? -taskSwipeActionWidthPx : 0,
      moved: false,
    };
  },

  onTaskTouchMove(e) {
    const gesture = this._taskSwipeGesture;
    if (!gesture) {
      return;
    }
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    if (gesture.lockDirection === "pending") {
      if (Math.abs(deltaX) < SWIPE_DIRECTION_LOCK_DISTANCE_PX && Math.abs(deltaY) < SWIPE_DIRECTION_LOCK_DISTANCE_PX) {
        return;
      }
      gesture.lockDirection = Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (gesture.lockDirection !== "horizontal") {
      return;
    }

    const minOffset = -this.data.taskSwipeActionWidthPx;
    const maxOffset = gesture.startOffset < 0 ? SWIPE_RIGHT_PULL_PX : 0;
    let nextOffset = gesture.startOffset + deltaX;
    if (nextOffset < minOffset) {
      nextOffset = minOffset;
    }
    if (nextOffset > maxOffset) {
      nextOffset = maxOffset;
    }
    if (nextOffset === gesture.lastOffset) {
      return;
    }

    gesture.lastOffset = nextOffset;
    gesture.moved = true;
    this.setData({
      movingTaskId: gesture.taskId,
      movingTaskOffset: nextOffset,
    });
  },

  onTaskTouchEnd() {
    const gesture = this._taskSwipeGesture;
    if (!gesture) {
      return;
    }
    this._taskSwipeGesture = null;

    if (gesture.lockDirection === "vertical") {
      this.setData({
        movingTaskId: "",
        movingTaskOffset: 0,
      });
      return;
    }

    const openThreshold = -this.data.taskSwipeActionWidthPx * SWIPE_OPEN_THRESHOLD_RATIO;
    const shouldOpen = gesture.lastOffset <= openThreshold;
    if (gesture.moved) {
      this._taskTapGuard = {
        taskId: gesture.taskId,
        expiresAt: Date.now() + 180,
      };
    }
    this.setData({
      openedTaskId: shouldOpen ? gesture.taskId : "",
      movingTaskId: "",
      movingTaskOffset: 0,
    });
  },

  onTaskTouchCancel() {
    this.onTaskTouchEnd();
  },

  onTaskCardTap(e) {
    const { taskId } = e.currentTarget.dataset;
    if (!taskId) {
      return;
    }
    if (this._taskTapGuard && this._taskTapGuard.taskId === taskId) {
      if (Date.now() < this._taskTapGuard.expiresAt) {
        return;
      }
      this._taskTapGuard = null;
    }
    if (this.data.openedTaskId && this.data.openedTaskId === taskId) {
      this.closeOpenedTaskSwipe();
      return;
    }
    if (this.data.openedTaskId && this.data.openedTaskId !== taskId) {
      this.closeOpenedTaskSwipe();
    }
    this.openTaskEditor(taskId);
  },

  async onDeleteTask(e) {
    const { taskId } = e.currentTarget.dataset;
    if (!taskId) {
      return;
    }
    try {
      await api.deleteTask(taskId);
      this.closeOpenedTaskSwipe();
      this.showPageToast({
        text: "删除成功",
        type: "success",
        key: "task_delete_success",
      });
      await this.loadTasks(true);
    } catch (err) {
      this.showPageToast({
        text: err.message || "删除失败",
        type: "error",
        key: `task_delete_error:${err.message || "删除失败"}`,
      });
    }
  },

  onEditTask(e) {
    const { taskId } = e.currentTarget.dataset;
    this.openTaskEditor(taskId);
  },

  openTaskEditor(taskId) {
    if (!taskId) {
      return;
    }
    const task = (this.data.tasks || []).find((item) => item && item._id === taskId);
    if (!task) {
      this.showPageToast({
        text: "任务不存在",
        type: "error",
        key: "task_edit_not_found",
      });
      return;
    }
    this.closeOpenedTaskSwipe();
    this.openTaskModal("edit", task);
  },

  openTaskModal(mode, task = null) {
    const isEdit = mode === "edit";
    if (isEdit && (!task || !task._id)) {
      return;
    }

    const defaultForm = defaultTaskForm(this.data.today);
    const normalizedWeekdays = normalizeRepeatWeekdays(task && task.repeatRule && task.repeatRule.weekdays);
    const taskForm = isEdit
      ? {
          ...defaultForm,
          title: task.title || "",
          remark: task.remark || "",
          tagId: task.tagId ? String(task.tagId) : "",
          tagName: task.tagName || "",
          effectiveStartDate: task.effectiveStartDate || defaultForm.effectiveStartDate,
          effectiveEndDate: task.effectiveEndDate || "",
          repeatWeekdays: normalizedWeekdays,
        }
      : defaultForm;

    if (this._taskModalCloseTimer) {
      clearTimeout(this._taskModalCloseTimer);
      this._taskModalCloseTimer = null;
    }
    const initialAnimation = wx.createAnimation({
      duration: 0,
      timingFunction: "linear",
    });
    initialAnimation.translateY("100%").step();
    this.setData({
      taskModalVisible: true,
      taskModalClosing: false,
      taskModalMode: isEdit ? "edit" : "create",
      editingTaskId: isEdit ? task._id : "",
      taskForm,
      taskTagIndex: findTagIndex(this.data.tagOptions, taskForm.tagId),
      repeatWeekdayOptions: buildRepeatWeekdayOptions(taskForm.repeatWeekdays),
      taskModalAnimation: initialAnimation.export(),
    });
    this.loadTagOptions(true).catch(() => {});

    wx.nextTick(() => {
      const openAnimation = wx.createAnimation({
        duration: TASK_MODAL_ANIM_DURATION,
        timingFunction: "ease-out",
      });
      openAnimation.translateY("0").step();
      this.setData({
        taskModalAnimation: openAnimation.export(),
        taskTitleFocus: true,
      });
    });
  },

  onOpenCreateTask() {
    this.closeOpenedTaskSwipe();
    this.openTaskModal("create");
  },

  onCloseTaskModal() {
    if (!this.data.taskModalVisible || this.data.taskModalClosing) {
      return;
    }
    const closeAnimation = wx.createAnimation({
      duration: TASK_MODAL_ANIM_DURATION,
      timingFunction: "ease-in",
    });
    closeAnimation.translateY("100%").step();
    this.setData({
      taskModalClosing: true,
      taskModalAnimation: closeAnimation.export(),
    });
    if (this._taskModalCloseTimer) {
      clearTimeout(this._taskModalCloseTimer);
    }
    this._taskModalCloseTimer = setTimeout(() => {
      this._taskModalCloseTimer = null;
      this.setData({
        taskModalVisible: false,
        taskModalClosing: false,
        taskModalAnimation: null,
        taskModalSaving: false,
        taskTitleFocus: false,
      });
    }, TASK_MODAL_CLOSE_DELAY);
  },

  onMaskTap() {
    this.onCloseTaskModal();
  },

  onMaskTouchMove() {
    // 拦截背景滚动，避免弹窗打开时穿透到底层页面。
  },

  onPanelTap() {
    // 拦截冒泡，避免点击弹窗内容时触发遮罩关闭。
  },

  onTaskTitleInput(e) {
    this.setData({
      "taskForm.title": e.detail.value,
    });
  },

  onTaskRemarkInput(e) {
    this.setData({
      "taskForm.remark": e.detail.value,
    });
  },

  async loadTagOptions(force = false) {
    if (!force && this.data.tagOptions.length > 0) {
      return;
    }
    this.setData({ tagLoading: true });
    try {
      const data = await api.getTagOptions();
      const tagOptions = normalizeTagOptions(data.list || []);
      this.setData({
        tagOptions,
        taskTagIndex: findTagIndex(tagOptions, this.data.taskForm.tagId),
      });
    } catch (err) {
      this.showPageToast({
        text: err.message || "标签加载失败",
        type: "error",
        key: "tag_options_load_error",
      });
    } finally {
      this.setData({ tagLoading: false });
    }
  },

  onTaskTagTap(e) {
    const { tagId } = e.currentTarget.dataset;
    if (!tagId || this.data.tagLoading) {
      return;
    }
    const normalizedTagId = String(tagId);
    if (this.data.taskForm.tagId === normalizedTagId) {
      this.setData({
        taskTagIndex: -1,
        "taskForm.tagId": "",
        "taskForm.tagName": "",
      });
      return;
    }
    const index = findTagIndex(this.data.tagOptions, normalizedTagId);
    if (index < 0) {
      return;
    }
    const selected = this.data.tagOptions[index];
    if (!selected) {
      return;
    }
    this.setData({
      taskTagIndex: index,
      "taskForm.tagId": selected.tagId,
      "taskForm.tagName": selected.tagName,
    });
  },

  onTaskStartDateChange(e) {
    this.setData({
      "taskForm.effectiveStartDate": e.detail.value,
    });
  },

  onTaskEndDateChange(e) {
    this.setData({
      "taskForm.effectiveEndDate": e.detail.value,
    });
  },

  onToggleTaskRepeatWeekday(e) {
    const weekday = Number(e.currentTarget.dataset.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      return;
    }
    const selectedWeekdays = normalizeRepeatWeekdays(this.data.taskForm.repeatWeekdays);
    const exists = selectedWeekdays.includes(weekday);
    const nextWeekdays = exists
      ? selectedWeekdays.filter((item) => item !== weekday)
      : [...selectedWeekdays, weekday];
    const normalized = normalizeRepeatWeekdays(nextWeekdays);
    this.setData({
      "taskForm.repeatWeekdays": normalized,
      repeatWeekdayOptions: buildRepeatWeekdayOptions(normalized),
    });
  },

  async onSaveTask() {
    const { taskForm, taskModalMode, editingTaskId } = this.data;
    if (!taskForm.title || !taskForm.title.trim()) {
      wx.showToast({
        title: "请输入任务标题",
        icon: "none",
      });
      return;
    }
    if (!taskForm.effectiveStartDate) {
      wx.showToast({
        title: "请选择开始日期",
        icon: "none",
      });
      return;
    }

    const payload = {
      title: taskForm.title.trim(),
      remark: (taskForm.remark || "").trim(),
      tagId: taskForm.tagId || null,
      tagName: taskForm.tagName || null,
      effectiveStartDate: taskForm.effectiveStartDate,
      effectiveEndDate: taskForm.effectiveEndDate || null,
      repeatRule: {
        type: "weekly",
        weekdays: normalizeRepeatWeekdays(taskForm.repeatWeekdays),
      },
      status: 1,
    };

    this.setData({
      taskModalSaving: true,
    });

    try {
      if (taskModalMode === "create") {
        await api.createTask(payload);
      } else {
        await api.updateTask(editingTaskId, payload);
      }
      wx.showToast({
        title: "保存成功",
        icon: "success",
      });
      this.onCloseTaskModal();
      await Promise.all([this.loadPageData(), this.loadTasks(true)]);
    } catch (err) {
      wx.showToast({
        title: err.message || "保存失败",
        icon: "none",
      });
    } finally {
      this.setData({
        taskModalSaving: false,
      });
    }
  },
});
