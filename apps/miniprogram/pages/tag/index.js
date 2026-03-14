const api = require("../../services/api");
const { getToken, setToken } = require("../../services/http");

const TAG_MODAL_ANIM_DURATION = 160;
const TAG_MODAL_CLOSE_DELAY = TAG_MODAL_ANIM_DURATION + 20;
const SWIPE_DELETE_WIDTH_RPX = 156;
const SWIPE_DIRECTION_LOCK_DISTANCE_PX = 8;
const SWIPE_OPEN_THRESHOLD_RATIO = 0.4;
const SWIPE_RIGHT_PULL_PX = 12;

function defaultTagForm() {
  return {
    tagName: "",
  };
}

function normalizeTagList(list = []) {
  return (list || [])
    .map((item) => ({
      tagId: String(item.tagId || ""),
      tagName: String(item.tagName || "").trim(),
      sort: Number(item.sort) || 0,
      createdAt: Number(item.createdAt) || 0,
    }))
    .filter((item) => item.tagId && item.tagName)
    .sort((a, b) => {
      const bySort = a.sort - b.sort;
      if (bySort !== 0) {
        return bySort;
      }
      return a.createdAt - b.createdAt;
    });
}

Page({
  data: {
    ready: false,
    loading: false,
    errorText: "",
    tags: [],
    statusBarHeight: 0,
    navBarHeight: 44,
    swipeDeleteWidthPx: 0,
    openedTagId: "",
    movingTagId: "",
    movingOffset: 0,
    tagModalVisible: false,
    tagModalMode: "create",
    editingTagId: "",
    tagForm: defaultTagForm(),
    tagModalSaving: false,
    tagModalClosing: false,
    tagModalAnimation: null,
    tagNameFocus: false,
  },

  async onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const menuBtn = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sysInfo.statusBarHeight;
    const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    const swipeDeleteWidthPx = Math.round((SWIPE_DELETE_WIDTH_RPX / 750) * sysInfo.windowWidth);
    this.setData({
      statusBarHeight,
      navBarHeight,
      swipeDeleteWidthPx,
    });
    await this.bootstrap();
  },

  onUnload() {
    if (this._tagModalCloseTimer) {
      clearTimeout(this._tagModalCloseTimer);
      this._tagModalCloseTimer = null;
    }
    this._tagSwipeGesture = null;
  },

  async onPullDownRefresh() {
    this.closeOpenedTagSwipe();
    await this.loadTags();
    wx.stopPullDownRefresh();
  },

  async bootstrap() {
    this.setData({ loading: true, errorText: "" });
    try {
      await this.ensureLogin();
      await this.loadTags();
      this.setData({ ready: true });
    } catch (err) {
      this.setData({
        errorText: err.message || "加载失败，请重试",
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

  async loadTags() {
    this.setData({ loading: true, errorText: "" });
    try {
      const data = await api.getTags();
      this.setData({
        tags: normalizeTagList(data.list || []),
        openedTagId: "",
        movingTagId: "",
        movingOffset: 0,
      });
    } catch (err) {
      this.setData({
        errorText: err.message || "标签加载失败",
      });
    } finally {
      this.setData({ loading: false });
    }
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

  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({
          url: "/pages/index/index",
        });
      },
    });
  },

  closeOpenedTagSwipe() {
    if (!this.data.openedTagId && !this.data.movingTagId && this.data.movingOffset === 0) {
      return;
    }
    this.setData({
      openedTagId: "",
      movingTagId: "",
      movingOffset: 0,
    });
  },

  onTagTouchStart(e) {
    const { tagId } = e.currentTarget.dataset;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!tagId || !touch) {
      return;
    }

    const { openedTagId, swipeDeleteWidthPx } = this.data;
    if (openedTagId && openedTagId !== tagId) {
      this.closeOpenedTagSwipe();
    }

    this._tagSwipeGesture = {
      tagId,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffset: openedTagId === tagId ? -swipeDeleteWidthPx : 0,
      lockDirection: "pending",
      lastOffset: openedTagId === tagId ? -swipeDeleteWidthPx : 0,
    };
  },

  onTagTouchMove(e) {
    const gesture = this._tagSwipeGesture;
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

    const minOffset = -this.data.swipeDeleteWidthPx;
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
      movingTagId: gesture.tagId,
      movingOffset: nextOffset,
    });
  },

  onTagTouchEnd() {
    const gesture = this._tagSwipeGesture;
    if (!gesture) {
      return;
    }
    this._tagSwipeGesture = null;

    if (gesture.lockDirection === "vertical") {
      this.setData({
        movingTagId: "",
        movingOffset: 0,
      });
      return;
    }

    const openThreshold = -this.data.swipeDeleteWidthPx * SWIPE_OPEN_THRESHOLD_RATIO;
    const shouldOpen = gesture.lastOffset <= openThreshold;
    this.setData({
      openedTagId: shouldOpen ? gesture.tagId : "",
      movingTagId: "",
      movingOffset: 0,
    });
  },

  onTagTouchCancel() {
    this.onTagTouchEnd();
  },

  onTagCardTap(e) {
    const { tagId } = e.currentTarget.dataset;
    if (this.data.openedTagId && this.data.openedTagId === tagId) {
      this.closeOpenedTagSwipe();
    }
  },

  onOpenCreateTag() {
    this.closeOpenedTagSwipe();
    if (this._tagModalCloseTimer) {
      clearTimeout(this._tagModalCloseTimer);
      this._tagModalCloseTimer = null;
    }
    const initialAnimation = wx.createAnimation({
      duration: 0,
      timingFunction: "linear",
    });
    initialAnimation.translateY("100%").step();
    this.setData({
      tagModalVisible: true,
      tagModalClosing: false,
      tagModalMode: "create",
      editingTagId: "",
      tagForm: defaultTagForm(),
      tagModalAnimation: initialAnimation.export(),
    });
    wx.nextTick(() => {
      const openAnimation = wx.createAnimation({
        duration: TAG_MODAL_ANIM_DURATION,
        timingFunction: "ease-out",
      });
      openAnimation.translateY("0").step();
      this.setData({
        tagModalAnimation: openAnimation.export(),
        tagNameFocus: true,
      });
    });
  },

  onOpenEditTag(e) {
    const { tagId } = e.currentTarget.dataset;
    if (!tagId) {
      return;
    }
    const target = this.data.tags.find((item) => item.tagId === tagId);
    if (!target) {
      return;
    }
    this.closeOpenedTagSwipe();
    if (this._tagModalCloseTimer) {
      clearTimeout(this._tagModalCloseTimer);
      this._tagModalCloseTimer = null;
    }
    const initialAnimation = wx.createAnimation({
      duration: 0,
      timingFunction: "linear",
    });
    initialAnimation.translateY("100%").step();
    this.setData({
      tagModalVisible: true,
      tagModalClosing: false,
      tagModalMode: "edit",
      editingTagId: tagId,
      tagForm: {
        tagName: target.tagName,
      },
      tagModalAnimation: initialAnimation.export(),
    });
    wx.nextTick(() => {
      const openAnimation = wx.createAnimation({
        duration: TAG_MODAL_ANIM_DURATION,
        timingFunction: "ease-out",
      });
      openAnimation.translateY("0").step();
      this.setData({
        tagModalAnimation: openAnimation.export(),
        tagNameFocus: true,
      });
    });
  },

  onCloseTagModal() {
    if (!this.data.tagModalVisible || this.data.tagModalClosing) {
      return;
    }
    const closeAnimation = wx.createAnimation({
      duration: TAG_MODAL_ANIM_DURATION,
      timingFunction: "ease-in",
    });
    closeAnimation.translateY("100%").step();
    this.setData({
      tagModalClosing: true,
      tagModalAnimation: closeAnimation.export(),
    });
    if (this._tagModalCloseTimer) {
      clearTimeout(this._tagModalCloseTimer);
    }
    this._tagModalCloseTimer = setTimeout(() => {
      this._tagModalCloseTimer = null;
      this.setData({
        tagModalVisible: false,
        tagModalClosing: false,
        tagModalAnimation: null,
        tagModalSaving: false,
        tagNameFocus: false,
      });
    }, TAG_MODAL_CLOSE_DELAY);
  },

  onMaskTap() {
    this.onCloseTagModal();
  },

  onMaskTouchMove() {
    // 拦截背景滚动，避免弹窗打开时穿透到底层页面。
  },

  onPanelTap() {
    // 拦截冒泡，避免点击弹窗内容时触发遮罩关闭。
  },

  onTagNameInput(e) {
    this.setData({
      "tagForm.tagName": e.detail.value,
    });
  },

  async onSaveTag() {
    if (this.data.tagModalSaving) {
      return;
    }
    const tagName = (this.data.tagForm.tagName || "").trim();
    if (!tagName) {
      this.showPageToast({
        text: "请输入标签名称",
        type: "error",
        key: "tag_name_required",
      });
      return;
    }

    this.setData({ tagModalSaving: true });
    try {
      if (this.data.tagModalMode === "create") {
        await api.createTag({ tagName });
        this.showPageToast({
          text: "新增成功",
          type: "success",
          key: "tag_create_success",
        });
      } else {
        await api.updateTag(this.data.editingTagId, { tagName });
        this.showPageToast({
          text: "保存成功",
          type: "success",
          key: "tag_update_success",
        });
      }
      this.onCloseTagModal();
      await this.loadTags();
    } catch (err) {
      this.showPageToast({
        text: err.message || "保存失败",
        type: "error",
        key: `tag_save_error:${err.message || "保存失败"}`,
      });
    } finally {
      this.setData({ tagModalSaving: false });
    }
  },

  async onDeleteTag(e) {
    const { tagId } = e.currentTarget.dataset;
    if (!tagId) {
      return;
    }
    try {
      await api.deleteTag(tagId);
      this.closeOpenedTagSwipe();
      this.showPageToast({
        text: "删除成功",
        type: "success",
        key: "tag_delete_success",
      });
      await this.loadTags();
    } catch (err) {
      this.showPageToast({
        text: err.message || "删除失败",
        type: "error",
        key: `tag_delete_error:${err.message || "删除失败"}`,
      });
    }
  },
});
