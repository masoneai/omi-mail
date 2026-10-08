<template>
  <div class="email-container">
    <div class="header-actions">
      <el-checkbox
          v-model="checkAll"
          :indeterminate="isIndeterminate"
          :disabled="!visibleEmails.length || loading"
          :aria-label="copy.selectAll"
          @change="handleCheckAllChange"
      />
      <div class="header-left">
        <slot name="first"></slot>
        <button class="toolbar-button" :title="copy.refresh" :aria-label="copy.refresh" :disabled="loading" @click="refresh">
          <Icon :class="{ spinning: loading }" icon="ion:reload" width="18" height="18" />
        </button>
        <template v-if="checkedEmailCount > 0">
          <span class="selection-count">{{ copy.selected(checkedEmailCount) }}</span>
          <button v-perm="'email:delete'" class="toolbar-button danger" :title="t('delete')" :aria-label="t('delete')" @click="handleDelete">
            <Icon icon="uiw:delete" width="17" height="17" />
          </button>
          <button v-perm="'email:delete'" v-if="showUnread" class="toolbar-button" :title="t('markAsRead')" :aria-label="t('markAsRead')" @click="handleRead">
            <Icon icon="fluent:mail-read-20-regular" width="20" height="20" />
          </button>
        </template>
        <div v-else-if="showUnread" class="list-filters" :aria-label="copy.filters">
          <button :class="{ active: !unreadOnly }" :aria-pressed="!unreadOnly" @click="setUnreadFilter(false)">{{ copy.all }}</button>
          <button :class="{ active: unreadOnly }" :aria-pressed="unreadOnly" @click="setUnreadFilter(true)">
            {{ copy.unread }} <span class="filter-count">{{ loadedUnreadCount }}</span>
          </button>
        </div>
      </div>
      <div class="header-right">
        <span class="email-count">{{ unreadOnly ? copy.loadedScope : $t('emailCount', {total: type === 'draft' ? emailList.length : total}) }}</span>
        <button v-if="showAccountIcon" class="toolbar-button account-toggle" :title="copy.mailboxes" :aria-label="copy.mailboxes" :aria-expanded="accountShow" @click="changeAccountShow">
          <Icon width="18" height="18" icon="solar:sidebar-minimalistic-linear" />
        </button>
      </div>
    </div>

    <div ref="scroll" class="scroll">
      <UseVirtualList ref="scrollbarRef"
                        @scroll="onScroll"
                        :list="list"
                        :options="{ itemHeight: itemHeight, overscan: 15 }"
                        class="virtual"
                        style="height: 100%"
                        v-if="!loading && visibleEmails.length > 0"
                        :key="keyCount"
        >
          <template #default="{ data: item, index }" >
            <div :class="['email-row', props.type, { 'right-checked': item.rightChecked }]"
                 :data-checked="item.checked"
                 :data-unread="showUnread && item.unread === EmailUnreadEnum.UNREAD"
                 role="button"
                 tabindex="0"
                 :aria-label="`${item.name || ''} ${item.subject || copy.untitled}`"
                 @keydown.enter.self="jumpDetails(item)"
                 @keydown.space.self.prevent="jumpDetails(item)"
                 @click="jumpDetails(item)"
                 v-if="!item.expand"
                 :key="item.emailId"
                 @contextmenu="handleContextmenu($event, item)"
            >
              <el-checkbox :class=" props.type === 'all-email' ? 'all-email-checkbox' : 'checkbox'"
                           v-model="item.checked"
                           :aria-label="copy.selectMessage"
                           :disabled="!item.checked && isSelectMax"
                           @click.stop></el-checkbox>
              <button @click.stop="starChange(item)" class="pc-star" v-if="showStar" :class="{ starred: item.isStar }" :aria-label="t('star')" :aria-pressed="!!item.isStar" :disabled="!allowStar && !item.isStar">
                <Icon :icon="item.isStar ? 'fluent:star-20-filled' : 'solar:star-line-duotone'" width="18" height="18" />
              </button>
              <div v-if="!showStar"></div>
              <div class="title" :class="accountShow ? 'title-column' : 'title-column'">

                <div class="email-sender" :style=" (showStatus ? 'gap: 10px;' : '') + ((item.unread === EmailUnreadEnum.UNREAD && showUnread)  ? 'font-weight: bold' : '')">
                  <div class="email-status" v-if="showStatus">
                    <el-tooltip effect="dark" :content="item.statusIcon.content">
                      <Icon :icon="item.statusIcon.icon" :style="`color: ${item.statusIcon.color}`" width="20" height="20"/>
                    </el-tooltip>
                    <div class="del-status" v-if="item.isDel">
                      <el-tooltip effect="dark" :content="item.isDelContent">
                        <Icon class="icon" icon="mdi:email-remove" width="20" height="20"/>
                      </el-tooltip>
                    </div>
                  </div>
                  <div v-else></div>
                  <span class="name">
                    <span>
                      <div class="unread" v-if="isMobile && (item.unread === EmailUnreadEnum.UNREAD && showUnread) "/>
                      <slot name="name" :email="item"> {{ item.name }}</slot>
                    </span>
                    <span>
                      <Icon v-if="item.isStar" icon="fluent-color:star-16" width="18" height="18"/>
                    </span>
                  </span>
                  <span class="phone-time">{{ item.formatCreateTime }}</span>
                </div>
                <div>
                  <div class="email-text">
                    <span class="email-subject" :style="(item.unread === EmailUnreadEnum.UNREAD && showUnread)  ? 'font-weight: bold' : ''">
                      <div class="unread" v-if="!isMobile && (item.unread === EmailUnreadEnum.UNREAD && showUnread) "/>
                      <span v-if="item.code" class="code-tag" @click.stop="copyCode(item.code)">[{{ t('codeLabel') }}{{ item.code }}]</span>
                      <span class="subject-text">
                        <slot name="subject" :email="item" >
                          {{ item.subject || copy.untitled }}
                        </slot>
                      </span>
                    </span>
                    <span class="email-content">{{ item.listText || item.text || '\u200B' }}</span>
                  </div>
                  <div class="user-info" v-if="showUserInfo">
                    <div class="user">
                      <span>
                        <Icon icon="mynaui:user" width="20" height="20"/>
                      </span>
                      <span>{{ item.userEmail }}</span>
                    </div>
                    <div class="account">
                      <span>
                        <Icon icon="mdi-light:email" width="20" height="20"/>
                      </span>
                      <span>{{ item.type === 0 ? item.toEmail : item.sendEmail }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="email-right" :style="showUserInfo ? 'align-self: start;':''">
                <span class="email-time" :style="(item.unread === EmailUnreadEnum.UNREAD && showUnread) ? 'font-weight: bold' : ''">{{ item.formatCreateTime }}</span>
              </div>
            </div>
            <skeletonBlock v-else-if="item.expand === 'loading'"
                           :rows="1"
                           :showStar="showStar"
                           :accountShow="accountShow"
                           :showStatus="showStatus"
                           :showUserInfo="showUserInfo"
                           :type="type"/>
            <div class="noLoading" v-else-if="item.expand === 'noMoreData'">
              <div>{{ $t('noMoreData') }}</div>
            </div>
          </template>
        </UseVirtualList>
      <skeletonBlock v-if="firstLoad && showFirstLoading"
                       :rows="20"
                       :showStar="showStar"
                       :accountShow="accountShow"
                       :showStatus="showStatus"
                       :showUserInfo="showUserInfo"
                       :type="type"/>
      <skeletonBlock v-if="loading"
                       :rows="skeletonRows"
                       :showStar="showStar"
                       :accountShow="accountShow"
                       :showStatus="showStatus"
                       :showUserInfo="showUserInfo"
                       :type="type"/>
      <div class="empty" v-if="!loading && !firstLoad && visibleEmails.length === 0">
        <slot name="empty" :unread-only="unreadOnly" :load-error="loadError">
          <div class="empty-state">
            <div class="empty-art" aria-hidden="true">
              <span class="empty-dot dot-one"></span><span class="empty-dot dot-two"></span>
              <div class="empty-envelope"><Icon :icon="loadError ? 'solar:cloud-cross-linear' : (unreadOnly ? 'solar:check-read-linear' : 'solar:letter-linear')" width="48" height="48" /></div>
            </div>
            <span class="empty-eyebrow">{{ copy.emptyEyebrow }}</span>
            <h2>{{ loadError ? copy.loadError : (unreadOnly ? copy.noUnread : (type === 'email' ? copy.inboxQuiet : t('noMessagesFound'))) }}</h2>
            <p>{{ loadError ? copy.loadErrorHint : (unreadOnly ? (noLoading ? copy.unreadCompleteHint : copy.unreadHint) : (type === 'email' ? copy.inboxHint : copy.emptyHint)) }}</p>
            <div class="empty-actions">
              <button v-if="loadError" class="empty-primary" @click="refresh"><Icon icon="ion:reload" width="16" height="16" />{{ copy.retry }}</button>
              <template v-else-if="type === 'email' && !unreadOnly">
                <button v-perm="'email:send'" class="empty-primary" @click="uiStore.writerRef?.open()"><Icon icon="solar:pen-new-square-linear" width="17" height="17" />{{ copy.compose }}</button>
                <button v-if="currentAddress" class="empty-secondary" @click="copyCode(currentAddress)"><Icon icon="solar:copy-linear" width="17" height="17" />{{ copy.copyAddress }}</button>
              </template>
              <button v-else-if="unreadOnly" class="empty-secondary" @click="setUnreadFilter(false)">{{ copy.seeAll }}</button>
            </div>
          </div>
        </slot>
      </div>
    </div>
    <div v-if="unreadOnly && !loading" class="filter-footer">
      <span>{{ copy.loadedScope }} · {{ copy.loadedCount(emailList.length) }}</span>
      <button v-if="!noLoading" class="load-more" :disabled="followLoading" @click="loadData">{{ followLoading ? copy.loading : copy.loadMore }}<Icon icon="solar:arrow-down-linear" width="14" height="14" /></button>
    </div>
    <el-dropdown
        ref="dropdownRef"
        @visible-change="visibleChange"
        :virtual-ref="triggerRef"
        :show-arrow="false"
        :popper-options="{
      modifiers: [{ name: 'offset', options: { offset: [0, 0] } }],
    }"
        virtual-triggering
        trigger="contextmenu"
        placement="bottom-start"
    >
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="rightClickEmail.code" @click="copyCode(rightClickEmail.code)" >
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="fluent-color:clipboard-24" width="20" height="20" />
                <span>{{t('copyCode')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email'].includes(props.type)" @click="emailRead(rightClickEmail.emailId)" >
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="fluent:mail-read-20-regular" width="20" height="20" />
                <span>{{t('markAsRead')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','star'].includes(props.type)" @click="openReply(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="la:reply" width="20" height="20"  />
                <span>{{t('reply')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','send', 'star'].includes(props.type)" @click="openForward(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:arrow-up-right" width="19" height="19"  />
                <span>{{t('forward')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','send', 'star'].includes(props.type)" @click="starChange(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="solar:star-line-duotone" width="19" height="19"/>
                <span>{{t('star')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="props.type === 'all-email'" @click="handleSearch('user', rightClickEmail.userEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:search" width="20" height="20" />
                <span>{{t('searchUser')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="props.type === 'all-email' " @click="handleSearch('account', rightClickEmail.toEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:search" width="20" height="20" />
                <span>{{t('searchEmail')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="props.type === 'all-email' " @click="handleSearch('name', rightClickEmail.name)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:search" width="20" height="20" />
                <span>{{t('searchSender')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item @click="rightDelete(rightClickEmail.emailId)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="uiw:delete" width="16" height="20" style="margin-left: 1px;margin-right: 3px" />
                <span>{{t('delete')}}</span>
              </div>
            </template>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import {Icon} from "@iconify/vue";
import skeletonBlock from "@/components/email-scroll/skeleton/index.vue"
import {computed, onActivated, reactive, ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import {useEmailStore} from "@/store/email.js";
import {useUiStore} from "@/store/ui.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {sleep} from "@/utils/time-utils.js"
import {fromNow} from "@/utils/day.js";
import {useI18n} from "vue-i18n";
import {EmailUnreadEnum} from "@/enums/email-enum.js";
import { UseVirtualList } from '@vueuse/components'
import { useScroll } from '@vueuse/core'

const props = defineProps({
  getEmailList: Function,
  emailDelete: Function,
  emailRead: Function,
  starAdd: Function,
  starCancel: Function,
  cancelSuccess: Function,
  starSuccess: Function,
  actionLeft: {
    type: String,
    default: '0'
  },
  timeSort: {
    type: Number,
    default: 0,
  },
  showStatus: {
    type: Boolean,
    default: false
  },
  showAccountIcon: {
    type: Boolean,
    default: true,
  },
  showUserInfo: {
    type: Boolean,
    default: false
  },
  showStar: {
    type: Boolean,
    default: true
  },
  allowStar: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    default: 'email'
  },
  showFirstLoading: {
    type: Boolean,
    default: true
  },
  showUnread: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['jump', 'refresh-before', 'delete-draft', 'right-search'])
const {t, locale} = useI18n()
const settingStore = useSettingStore()
const uiStore = useUiStore();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const unreadOnly = ref(false);
const loadError = ref(false);
const currentAddress = computed(() => accountStore.currentAccount.email || '');
const copy = computed(() => locale.value?.startsWith('en') ? {
  selectAll: 'Select messages in this list', selectMessage: 'Select message', refresh: 'Refresh mail', selected: count => `${count} selected`,
  filters: 'Filter this list', all: 'All', unread: 'Unread', loadedScope: 'Current loaded messages', loadedCount: count => `${count} loaded`,
  mailboxes: 'Show mailboxes', untitled: '(No subject)', emptyEyebrow: 'A LITTLE SPACE FOR WHAT MATTERS', inboxQuiet: 'Your inbox is quiet',
  inboxHint: 'New messages will appear here. Share your address, or start a conversation.', noUnread: 'All caught up',
  unreadHint: 'No unread messages in this list. Load more to check earlier mail.', unreadCompleteHint: 'There are no unread messages. New mail will appear here.', emptyHint: 'Your messages will appear here.',
  loadError: 'Mail could not be loaded', loadErrorHint: 'Please check your connection and try again.', retry: 'Try again',
  compose: 'Write a message', copyAddress: 'Copy address', seeAll: 'View all messages', loadMore: 'Load more messages', loading: 'Loading…'
} : {
  selectAll: '选择当前列表邮件', selectMessage: '选择邮件', refresh: '刷新邮件', selected: count => `已选 ${count} 封`,
  filters: '筛选当前列表', all: '全部', unread: '未读', loadedScope: '当前已加载邮件', loadedCount: count => `已加载 ${count} 封`,
  mailboxes: '切换邮箱', untitled: '（无主题）', emptyEyebrow: '留一点空间，给重要的消息', inboxQuiet: '收件箱很安静',
  inboxHint: '新的邮件会出现在这里。分享你的邮箱地址，或主动开启一段对话。', noUnread: '当前列表已读完',
  unreadHint: '已加载的邮件里没有未读消息。可以继续加载，查看更早的邮件。', unreadCompleteHint: '这里没有未读邮件。新的消息到来后会显示在这里。', emptyHint: '邮件会在这里整齐呈现。',
  loadError: '暂时无法加载邮件', loadErrorHint: '检查网络连接后，再试一次。', retry: '重新加载',
  compose: '写一封邮件', copyAddress: '复制邮箱地址', seeAll: '查看全部邮件', loadMore: '加载更多邮件', loading: '正在加载…'
});
const loadedUnreadCount = computed(() => emailList.filter(email => email.unread === EmailUnreadEnum.UNREAD).length);
const visibleEmails = computed(() => unreadOnly.value && props.showUnread ? emailList.filter(email => email.unread === EmailUnreadEnum.UNREAD) : emailList);
function setUnreadFilter(value) {
  unreadOnly.value = value;
  emailList.forEach(email => { email.checked = false; });
  scrollTop = 0;
  nextTick(() => scrollbarRef.value?.scrollTo(0));
}

const loading = ref(false);
const followLoading = ref(false);
const noLoading = ref(false);
const emailList = reactive([])
const expandList = reactive([])
const total = ref(0);
const checkAll = ref(false);
const isIndeterminate = ref(false);
const scroll = ref(null)
const firstLoad = ref(true)
let scrollTop = 0
const latestEmail = ref(null)
const scrollbarRef = ref(null)
let reqLock = false
let pendingRefresh = false
let disposed = false
let isMobile = ref(innerWidth < 1367)
let skeletonRows = 0
const keyCount = ref(0);
const dropdownRef = ref(null);
const dropdownCloseLock = ref(false);
const dropdownShow = ref(false);
const rightClickEmail = ref({});
const MAX_SELECT_COUNT = 95;
const checkedEmailCount = ref(0);
const isSelectMax = computed(() => checkedEmailCount.value >= MAX_SELECT_COUNT);
let timer = null
const position = ref(
    DOMRect.fromRect({
      x: 0,
      y: 0,
    })
)

const triggerRef = ref({
  getBoundingClientRect() {
    return position.value;
  }
})

const queryParam = reactive({
  size: 50
});

defineExpose({
  refreshList,
  deleteEmail,
  addItem,
  handleList,
  emailList,
  firstLoad,
  latestEmail,
  noLoading,
  total
})

onActivated(() => {
  requestAnimationFrame(() => {
    const index = scrollTop / itemHeight.value
    scrollbarRef.value?.scrollTo(index);
  })
})

onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('wheel', closeDropdownOnWheel, { passive: true });
  timer = setInterval(() => {
    emailList.forEach(email => {
      email.formatCreateTime = fromNow(email.createTime);
    })
  }, 1000 * 60);
})

onUnmounted(() => {
  disposed = true;
  clearInterval(timer);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('wheel', closeDropdownOnWheel);
})

getEmailList()

function handleResize() {
  isMobile.value = innerWidth < 1367;
}

function onScroll(e) {
  scrollTop = e.target.scrollTop;
}

const { arrivedState } = useScroll(scrollbarRef, {
  offset: { bottom: isMobile.value ? 2200 : 1500 }
})


const list = computed(() => {
  return [...visibleEmails.value, ...(visibleEmails.value.length ? expandList : [])]
})

const itemHeight = computed(() => {
    if (props.type === 'all-email') {
      return isMobile.value ? 136 : 84;
    } else  {
      return isMobile.value ? 92 : 64;
    }
})

watch(emailList, () => {
  updateHasScrollbar();
})

watch(scrollbarRef, () => {
  updateHasScrollbar();
})

// 强制刷新 (itemHeight 更改后虚拟滚动列表不会自己更新)
watch(itemHeight, () => {
  keyCount.value ++
})

watch(followLoading, (isFollowLoading) => {
  if (isFollowLoading) {
    expandList.push({
      emailId: 0,
      expand: 'loading'
    })
  } else {
    const index = expandList.findIndex(item => item.expand === 'loading')
    if (index > -1) expandList.splice(index, 1);
  }
});

watch(noLoading, (isNoLoading) => {
  if (isNoLoading) {
    expandList.push({
      emailId: 0,
      expand: 'noMoreData'
    })
  } else {
    const index = expandList.findIndex(item => item.expand === 'noMoreData')
    if (index > -1) expandList.splice(index, 1);
  }
})


// 监听是否到达底部
watch(() => arrivedState.bottom, (isBottom) => {
  if (isBottom && !loading.value) {
    loadData();
  }
});

watch(
    () => emailList.map(item => item.checked),
    () => {
      checkedEmailCount.value = emailList.length
      if (emailList.length > 0) {
        updateCheckStatus();
      }
    },
    {deep: true}
);


watch(() => emailStore.deleteIds, () => {
  if (emailStore.deleteIds) {
    deleteEmail(emailStore.deleteIds)
  }
})

watch(() => emailStore.cancelStarEmailId, () => {
  emailList.forEach(email => {
    if (email.emailId === emailStore.cancelStarEmailId) {
      email.isStar = 0
    }
  })
})

watch(() => emailStore.addStarEmailId, () => {
  emailList.forEach(email => {
    if (email.emailId === emailStore.addStarEmailId) {
      email.isStar = 1
    }
  })
})

function closeDropdownOnWheel() {
  if (dropdownShow.value) dropdownRef.value?.handleClose();
}

function openReply(email) {
  const fullEmail = emailStore.detailMap[email.emailId]
  if (!fullEmail) return
  uiStore.writerRef.openReply(fullEmail)
}

function openForward(email) {
  const fullEmail = emailStore.detailMap[email.emailId]
  if (!fullEmail) return
  uiStore.writerRef.openForward(fullEmail)
}

function visibleChange(e) {
  dropdownShow.value = e;
  dropdownCloseLock.value = true;
  setTimeout(() => {
    dropdownCloseLock.value = false;
  },1500)

  if (!e && rightClickEmail.value.rightChecked) {
    rightClickEmail.value.rightChecked = false
  }
}

const handleContextmenu = (event, email) => {

  if (props.type === 'draft') {
    return
  }

  if (rightClickEmail.value.rightChecked) {
    rightClickEmail.value.rightChecked = false
  }

  const { clientX, clientY } = event
  position.value = DOMRect.fromRect({
    x: clientX,
    y: clientY,
  })
  event.preventDefault();
  dropdownRef.value?.handleOpen();

  rightClickEmail.value = email;
  rightClickEmail.value.rightChecked = true
}

function updateHasScrollbar() {
  nextTick(() => {
    const virtual = scroll.value?.querySelector('.virtual');
    if (virtual) virtual.style.scrollbarGutter = 'stable';
  });
}

function getSkeletonRows() {
  if (emailList.length > 20) return skeletonRows = 20
  if (emailList.length === 0) return skeletonRows = 1
  skeletonRows = emailList.length
}

const accountShow = computed(() => {
  return uiStore.accountShow && settingStore.settings.manyEmail === 0
})

function starChange(email) {

  if (!email.isStar) {

    if (!props.allowStar) return;

    email.isStar = 1;
    props.starAdd(email.emailId).then(() => {
      email.isStar = 1;
      props.starSuccess?.(email)
    }).catch(e => {
      console.error(e)
      email.isStar = 0
    })
  } else {

    email.isStar = 0;
    props.starCancel(email.emailId).then(() => {
      email.isStar = 0;
      props.cancelSuccess?.(email)
    }).catch(e => {
      console.error(e)
      email.isStar = 1;
    })
  }
}

function changeAccountShow() {
  uiStore.accountShow = !uiStore.accountShow;
}

const handleRead = async () => {
  const emailIds = getSelectedMailsIds();
  try {
    await props.emailRead(emailIds);
    localRead(emailIds);
  } catch (error) {
    console.error(error);
  }
}

async function emailRead(emailId) {
  try {
    await props.emailRead([emailId]);
    localRead([emailId]);
  } catch (error) {
    console.error(error);
  }
}

function localRead(emailIds) {
  emailIds.forEach(emailId => {
    const index = emailList.findIndex(email => email.emailId === emailId);
    if (index > -1) {
      emailList[index].unread = EmailUnreadEnum.READ;
      emailList[index].checked = false;
    }
  })
}

function rightDelete(emailId) {

  if (props.type === 'all-email') {
    ElMessageBox.confirm(t('delOneEmailConfirm'), {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      type: 'warning'
    }).then(() => {
      props.emailDelete([emailId]).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true
        })
        emailStore.deleteIds = [emailId];
      })
    })
    return;
  }
  props.emailDelete([emailId]).then(() => {
    ElMessage({
      message: t('delSuccessMsg'),
      type: 'success',
      plain: true
    })
    emailStore.deleteIds = [emailId];
  })
}

function handleSearch(type, value) {
  emit('right-search', type, value);
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true
    })
  }
}

function handleDelete() {
  ElMessageBox.confirm(t('delEmailsConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {

    if (props.type === 'draft') {
      const draftIds = getSelectedDraftsIds();
      emit('delete-draft', draftIds);
      return;
    }

    const emailIds = getSelectedMailsIds();
    props.emailDelete(emailIds).then(() => {
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true
      })
      emailStore.deleteIds = emailIds;
    })
  })
}

function deleteEmail(emailIds) {
  const previousLength = emailList.length;
  emailIds.forEach(emailId => {
    emailList.forEach((item, index) => {
      if (emailId === item.emailId) {
        emailList.splice(index, 1);
      }
    })
  })
  total.value = Math.max(0, total.value - (previousLength - emailList.length));
  if (emailList.length < queryParam.size && !noLoading.value) {
    getEmailList()
  }
}

function addItem(email) {

  const existIndex = emailList.findIndex(item => item.emailId === email.emailId)

  if (existIndex > -1) {
    return false;
  }

  email.formatCreateTime = fromNow(email.createTime);

  if (props.timeSort) {
    if (noLoading.value) {
      handleList([email]);
      emailList.push(email);
    }

    if (email.emailId > (latestEmail.value?.emailId || 0)) {
      latestEmail.value = email
    }

    total.value++
    return true;
  }


  const index = emailList.findIndex(item => item.emailId < email.emailId)

  if (index !== -1) {
    handleList([email]);
    emailList.splice(index, 0, email);
  } else {
    if (noLoading.value) {
      handleList([email]);
      emailList.push(email);
    }
  }

  if (email.emailId > (latestEmail.value?.emailId || 0)) {
    latestEmail.value = email
  }

  total.value++
  return true;
}

function handleCheckAllChange(val) {
  if (val) {
    let count = 0;
    visibleEmails.value.forEach(item => {
      if (count < MAX_SELECT_COUNT) {
        item.checked = true;
        count++;
      } else {
        item.checked = false;
      }
    });
  } else {
    emailList.forEach(item => item.checked = false);
  }
  isIndeterminate.value = false;
}

// 获取选中的邮件列表id
function getSelectedMailsIds() {
  return emailList.filter(item => item.checked).map(item => item.emailId);
}

function getSelectedDraftsIds() {
  return emailList.filter(item => item.checked).map(item => item.draftId);
}

function updateCheckStatus() {
  const checkedCount = emailList.filter(item => item.checked).length;
  checkedEmailCount.value = checkedCount;
  const atMax = checkedCount >= MAX_SELECT_COUNT;
  checkAll.value = visibleEmails.value.length > 0 && (checkedCount === visibleEmails.value.length || atMax);
  isIndeterminate.value = checkedCount > 0 && !checkAll.value;
}

function jumpDetails(email) {

  if (dropdownShow.value) {
    dropdownRef.value.handleClose();
    return;
  }

  if (!dropdownCloseLock.value) {
    const sel = window.getSelection();
    if (sel.toString().trim()) {
      return
    }
  }
  emit('jump', email)
}


function getEmailList(refresh = false) {

  if (reqLock) {
    if (refresh) pendingRefresh = true;
    return;
  }
  loadError.value = false;
  let emailId = emailList.length > 0 ? emailList.at(-1).emailId : 0;

  reqLock = true

  if (!refresh) {

    if (loading.value || noLoading.value) {
      reqLock = false
      return
    }

  } else {
    getSkeletonRows()
    emailId = 0
    loading.value = true
    scrollTop = 0
  }

  if (emailList.length === 0) {
    loading.value = true
  } else {
    followLoading.value = !refresh;
  }
  let start = Date.now();

  return props.getEmailList(emailId, queryParam.size).then(async data => {
    if (disposed || pendingRefresh) return;
    let end = Date.now();
    let duration = end - start;
    if (duration < 300 && !emailId) {
        await sleep(300 - duration)
    }
    if (disposed || pendingRefresh) return;
    firstLoad.value = false

    let list = data.list.map(item => ({
      ...item,
      checked: false
    }));


    if (refresh) {
      emailList.length = 0
    }

    latestEmail.value = data.latestEmail

    handleList(list);
    emailList.push(...list);
    if (refresh) nextTick(() => scrollbarRef.value?.scrollTo(0));

    noLoading.value = props.type === 'draft' || data.list.length < queryParam.size;
    followLoading.value = false;

    total.value = data.total ?? emailList.length;
  }).catch(error => {
    if (!disposed && !pendingRefresh) {
      loadError.value = true;
      firstLoad.value = false;
      console.error(error);
    }
  }).finally(() => {
    loading.value = false;
    followLoading.value = false;
    reqLock = false;
    if (pendingRefresh && !disposed) {
      pendingRefresh = false;
      getEmailList(true);
    }
  })
}

function handleList(list) {
  list.forEach(email => {
    email.formatCreateTime = fromNow(email.createTime);
    email.test = t('received')
    const statusIconMap = {
      0: { icon: 'ic:round-mark-email-read', color: '#51C76B', content: t('received') },
      1: { icon: 'bi:send-arrow-up-fill',  color: '#51C76B', content: t('sent') },
      2: { icon: 'bi:send-check-fill',     color: '#51C76B', content: t('delivered') },
      3: { icon: 'bi:send-x-fill',         color: '#F56C6C', content: t('bounced') },
      8: { icon: 'bi:send-x-fill',         color: '#F56C6C', content: t('bounced') },
      4: { icon: 'bi:send-exclamation-fill', color: '#FBBD08', content: t('complained') },
      5: { icon: 'bi:send-arrow-up-fill',  color: '#FBBD08', content: t('delayed') },
      7: { icon: 'ic:round-mark-email-read', color: '#FBBD08', content: t('noRecipient') },
    };

    if (email.isDel) {
      email.isDelContent = t('selectDeleted');
    }
    email.statusIcon = statusIconMap[email.status] || { icon: 'solar:letter-linear', color: 'var(--mail-muted)', content: t('sent') };
  })
}

function refresh() {
  emit('refresh-before')
  if (props.skeleton) {
    scrollbarRef.value?.scrollTo(0)
  }
  refreshList()
}

function refreshList() {
  checkAll.value = false;
  isIndeterminate.value = false;
  getEmailList(true);
}

function loadData() {
  getEmailList()
}

</script>
<style lang="scss" scoped>
.email-container {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: calc(100% - 40px);
  min-height: 0;
  margin: 20px;
  overflow: hidden;
  border: 1px solid var(--mail-border, var(--el-border-color));
  border-radius: var(--mail-radius, 18px);
  background: var(--mail-surface, var(--el-bg-color));
  color: var(--mail-text, var(--el-text-color-primary));
  box-shadow: 0 8px 28px rgba(21, 47, 48, 0.025);
}
.header-actions {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--mail-border, var(--el-border-color));
  .header-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .header-right { display: flex; align-items: center; gap: 10px; }
  .email-count, .selection-count { font-size: 12px; color: var(--mail-muted, var(--el-text-color-secondary)); white-space: nowrap; }
  :deep(.icon) { cursor: pointer; border-radius: 7px; }
}
.toolbar-button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--mail-muted, var(--el-text-color-secondary));
  cursor: pointer;
  transition: color .18s ease, background .18s ease;
  &:hover { background: var(--el-color-primary-light-9); color: var(--mail-accent, var(--el-color-primary)); }
  &.danger:hover { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
  &:disabled { cursor: wait; opacity: .5; }
}
.list-filters {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  margin-left: 5px;
  border-radius: 9px;
  background: var(--mail-canvas, var(--el-fill-color-lighter));
  button { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 3px 10px; border-radius: 6px; font-size: 12px; color: var(--mail-muted); cursor: pointer; white-space: nowrap; }
  button.active { background: var(--mail-surface); color: var(--mail-accent); box-shadow: 0 1px 4px rgba(0, 0, 0, .055); font-weight: 600; }
  .filter-count { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; border-radius: 5px; background: var(--el-color-primary-light-9); color: var(--mail-accent); font-size: 10px; }
}
.scroll { min-height: 0; height: 100%; overflow: hidden; position: relative; .virtual { will-change: scroll-position; } }
:deep(.email-row) {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--mail-border, var(--el-border-color));
  cursor: pointer;
  position: relative;
  gap: 10px;
  transition: background .16s ease;
  &[data-unread="true"] { background: var(--el-color-primary-light-9); }
  &:hover { background: var(--email-hover-background, var(--el-fill-color-light)); }
  &[data-checked="true"], &.right-checked { background: var(--el-color-primary-light-8); }
  &.all-email { height: 84px; }
  .checkbox, .all-email-checkbox { display: flex; flex: 0 0 auto; margin: 0; }
  .pc-star { display: inline-flex; flex: 0 0 24px; align-items: center; justify-content: center; height: 28px; border-radius: 6px; color: var(--mail-muted, var(--el-text-color-placeholder)); cursor: pointer; }
  .pc-star:hover { background: var(--el-fill-color); }
  .pc-star.starred { color: #dba640; }
  .pc-star:disabled { cursor: default; opacity: .45; }
  .title { flex: 1; min-width: 0; display: grid; align-items: center; grid-template-columns: minmax(130px, 190px) minmax(0, 1fr); gap: 20px; }
  .email-sender { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; min-width: 0; }
  .email-status { display: flex; align-items: center; gap: 5px; }
  .name { min-width: 0; font-size: 13px; > span:first-child { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } > span:last-child { display: none; } }
  .phone-time { display: none; font-size: 11px; font-weight: 400; color: var(--mail-muted); }
  .email-text { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .email-subject { display: flex; align-items: center; gap: 6px; overflow: hidden; min-width: 0; white-space: nowrap; font-size: 13px; }
  .subject-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
  .email-content { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--mail-muted, var(--el-text-color-secondary)); font-size: 12px; }
  .code-tag { flex-shrink: 0; max-width: 145px; padding: 1px 5px; border-radius: 5px; color: var(--mail-accent); background: var(--el-color-primary-light-8); font-size: 11px; overflow: hidden; text-overflow: ellipsis; }
  .user-info { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 5px; color: var(--mail-muted); font-size: 11px; }
  .user, .account { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 250px; span:first-child { display: inline-flex; vertical-align: middle; margin-right: 4px; } }
  .email-right { display: flex; align-items: center; flex-shrink: 0; font-size: 11px; color: var(--mail-muted); white-space: nowrap; }
  .email-right-skeleton { display: flex; }
  .name-skeleton { width: 120px; height: 13px; }
  .email-text-skeleton .el-skeleton { display: flex; gap: 12px; }
  .text-skeleton-one { width: 40%; height: 13px; }
  .text-skeleton-two { width: 50%; height: 13px; }
  @media (max-width: 1366px) {
    height: 92px;
    &.all-email { height: 136px; }
    .title { grid-template-columns: minmax(0, 1fr); gap: 5px; }
    .email-sender { gap: 6px; }
    .phone-time { display: block; }
    .email-text { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .email-content { font-size: 12px; line-height: 17px; }
    .email-right, .email-right-skeleton { display: none; }
    .user-info { flex-direction: column; gap: 3px; }
    .email-text-skeleton .el-skeleton { flex-direction: column; gap: 6px; }
    .text-skeleton-one { width: 55%; }
    .text-skeleton-two { width: 88%; }
  }
  @media (pointer: coarse) { user-select: none; }
}
.noLoading { min-height: 48px; display: flex; align-items: center; justify-content: center; color: var(--mail-muted); font-size: 11px; }
.empty { height: 100%; display: flex; align-items: center; justify-content: center; padding: 28px; overflow: auto; }
.empty-state { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 400px; text-align: center; margin: auto; flex-shrink: 0; }
.empty-art { width: 160px; height: 126px; position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 22px; &::before { content: ''; width: 120px; height: 120px; border-radius: 50%; border: 1px dashed var(--el-color-primary-light-5); position: absolute; } }
.empty-envelope { width: 88px; height: 76px; display: flex; align-items: center; justify-content: center; border-radius: 20px; color: var(--mail-accent); background: var(--el-color-primary-light-9); border: 1px solid var(--el-color-primary-light-8); transform: rotate(-7deg); box-shadow: 0 10px 24px rgba(13, 116, 107, .05); }
.empty-dot { width: 8px; height: 8px; border-radius: 50%; position: absolute; background: var(--el-color-primary-light-5); }
.dot-one { top: 15px; right: 25px; }.dot-two { width: 5px; height: 5px; bottom: 20px; left: 22px; background: #e5c87c; }
.empty-eyebrow { color: var(--mail-accent); font-size: 10px; font-weight: 600; letter-spacing: 2px; margin-bottom: 12px; }
.empty-state h2 { font-size: 23px; font-weight: 600; letter-spacing: -.5px; margin: 0; color: var(--mail-text); }
.empty-state p { margin: 12px 0 23px; font-size: 13px; line-height: 1.9; color: var(--mail-muted); max-width: 325px; }
.empty-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; }
.empty-primary, .empty-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 9px; min-height: 38px; padding: 9px 15px; font-size: 12px; cursor: pointer; transition: filter .15s, background .15s; }
.empty-primary { background: var(--mail-accent); color: var(--mail-on-accent); &:hover { filter: brightness(1.06); } }
.empty-secondary { border: 1px solid var(--mail-border); color: var(--mail-text); background: var(--mail-surface); &:hover { background: var(--mail-canvas); } }
.filter-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 42px; padding: 8px 18px; border-top: 1px solid var(--mail-border); color: var(--mail-muted); font-size: 11px; }
.load-more { display: inline-flex; align-items: center; gap: 6px; color: var(--mail-accent); font-size: 11px; cursor: pointer; &:disabled { opacity: .5; cursor: wait; } }
.right-dropdown-item { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.del-status { display: inline-flex; align-items: center; color: var(--el-color-info); }
.unread { height: 5px; width: 5px; flex: 0 0 5px; background: var(--mail-accent); border-radius: 50%; display: inline-block; margin-right: 4px; vertical-align: middle; }
.spinning { animation: refresh-spin 1.2s linear infinite; }
@keyframes refresh-spin { to { transform: rotate(360deg); } }
@media (max-width: 767px) {
  .email-container { margin: 10px; height: calc(100% - 20px); border-radius: 14px; }
  .header-actions { padding: 9px 12px; gap: 8px; min-height: 57px; .header-left { gap: 4px; } .email-count { display: none; } }
  .list-filters { margin-left: 0; button { padding: 3px 7px; } }
  :deep(.email-row) { padding: 10px 12px; gap: 6px; .pc-star { flex-basis: 22px; } }
  .empty { padding: 22px; }
  .empty-art { margin-bottom: 12px; transform: scale(.88); }
  .empty-state h2 { font-size: 21px; }
  .empty-eyebrow { letter-spacing: 1px; }
}
@media (prefers-reduced-motion: reduce) { .spinning { animation: none; } }
</style>
