<template>
  <div class="header" :class="!hasPerm('email:send') ? 'not-send' : ''">
    <div class="header-btn">
      <button class="nav-toggle icon-item" :aria-label="copy.navigation" :aria-expanded="uiStore.asideShow" @click="changeAside">
        <Icon icon="lucide:panel-left" width="19" height="19" />
      </button>
      <div class="page-title">
        <span class="mobile-brand">{{ brandTitle }}</span>
        <span class="breadcrumb-item">{{ $t(route.meta.title) }}</span>
        <span class="page-description" :title="pageDescription">{{ pageDescription }}</span>
      </div>
    </div>
    <div class="toolbar">
      <span class="workspace-signature" :title="brandTitle"><BrandMark :size="18" /><span>{{ brandTitle }}</span></span>
      <button v-perm="'email:send'" class="mobile-compose icon-item" :aria-label="copy.compose" @click="openSend">
        <Icon icon="lucide:pen-line" width="19" />
      </button>
      <button class="theme-button icon-item" :aria-label="uiStore.dark ? copy.light : copy.dark" :title="uiStore.dark ? copy.light : copy.dark" @click="openDark($event)">
        <Icon :icon="uiStore.dark ? 'lucide:sun' : 'lucide:moon'" width="19" height="19" />
      </button>
      <button class="notice icon-item" :aria-label="copy.notice" :title="copy.notice" @click="openNotice">
        <Icon icon="lucide:megaphone" width="19" height="19" />
      </button>
      <el-dropdown trigger="click" @visible-change="e => userInfoShow = e" :teleported="false" popper-class="detail-dropdown">
        <button class="avatar" :aria-label="copy.profile + userStore.user.email" :aria-expanded="userInfoShow">
          <div class="avatar-text">
            <div>{{ formatName(userStore.user.email) }}</div>
          </div>
          <Icon class="setting-icon" icon="lucide:chevron-down" width="14" height="14"/>
        </button>
        <template #dropdown>
          <div class="user-details">
            <div class="details-avatar">
              {{ formatName(userStore.user.email) }}
            </div>
            <div class="user-name">
              {{ userStore.user.name }}
            </div>
            <div class="detail-email" @click="copyEmail(userStore.user.email)">
              {{ userStore.user.email }}
            </div>
            <div class="detail-user-type">
              <el-tag>{{ userStore.user.role.name }}</el-tag>
            </div>
            <div class="action-info">
              <div>
                <span style="margin-right: 10px">{{ $t('sendCount') }}</span>
                <span style="margin-right: 10px">{{ $t('accountCount') }}</span>
              </div>
              <div>
                <div>
                  <span v-if="sendCount" style="margin-right: 5px">{{ sendCount }}</span>
                  <el-tag v-if="!hasPerm('email:send')">{{ sendType }}</el-tag>
                  <el-tag v-else>{{ sendType }}</el-tag>
                </div>
                <div>
                  <el-tag v-if="settingStore.settings.manyEmail || settingStore.settings.addEmail">
                    {{ $t('disabled') }}
                  </el-tag>
                  <span v-else-if="accountCount && hasPerm('account:add')"
                        style="margin-right: 5px">{{ $t('totalUserAccount', {msg: accountCount}) }}</span>
                  <el-tag v-else-if="!accountCount && hasPerm('account:add')">{{ $t('unlimited') }}</el-tag>
                  <el-tag v-else-if="!hasPerm('account:add')">{{ $t('unauthorized') }}</el-tag>
                </div>
              </div>
            </div>
            <div class="logout">
              <el-button type="primary" :loading="logoutLoading" @click="clickLogout">{{ $t('logOut') }}</el-button>
            </div>
          </div>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import router from "@/router";
import {logout} from "@/request/login.js";
import {Icon} from "@iconify/vue";
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import {useRoute} from "vue-router";
import {computed, ref} from "vue";
import {useSettingStore} from "@/store/setting.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {useAccountStore} from "@/store/account.js"
import {useEmailStore} from "@/store/email.js"
import BrandMark from '@/components/brand-mark/index.vue'

const {t, locale} = useI18n();
const accountStore = useAccountStore();
const emailStore = useEmailStore();
const route = useRoute();
const settingStore = useSettingStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const logoutLoading = ref(false)
const userInfoShow = ref(false)
const brandTitle = computed(() => settingStore.settings.title || 'Omi Mail')
const currentAddress = computed(() => accountStore.currentAccount.email || userStore.user.email || '')

const copy = computed(() => locale.value.startsWith('en') ? {
  navigation: 'Toggle navigation', compose: 'Compose', light: 'Switch to light mode', dark: 'Switch to dark mode',
  notice: 'Announcements', profile: 'Account: ', inbox: 'Letters find their home here.',
  unifiedInbox: 'Incoming mail from all your addresses.',
  sent: 'Letters on their way.', draft: 'A letter in the making.', star: 'Letters worth keeping close.',
  setting: 'Arrange your little post office.', management: 'Your domains, addresses and people.'
} : {
  navigation: '切换导航栏', compose: '写邮件', light: '切换浅色模式', dark: '切换深色模式',
  notice: '查看公告', profile: '账号：', inbox: '每一封来信，都有归处。',
  unifiedInbox: '汇总所有邮箱的收件邮件',
  sent: '寄出的心意，都留在这里。', draft: '一封信，正在酝酿。', star: '值得珍藏的信，随手可见。',
  setting: '布置你的专属邮局。', management: '管理你的域名、地址与成员。'
})
const pageDescription = computed(() => {
  const name = route.meta.name
  if (name === 'unified-inbox') return copy.value.unifiedInbox
  if (name === 'content' && uiStore.messageSource === 'unified-inbox') {
    return emailStore.contentData.email?.toEmail || copy.value.unifiedInbox
  }
  if (['content', 'email', 'send'].includes(name) && currentAddress.value) return currentAddress.value
  const copyName = name === 'email' ? 'inbox' : (name === 'send' ? 'sent' : name)
  return copy.value[copyName] || copy.value.management
})


const accountCount = computed(() => {
  return userStore.user.role.accountCount
})

const sendType = computed(() => {

  if (settingStore.settings.send === 1) {
    return t('disabled')
  }

  if (!hasPerm('email:send')) {
    return t('unauthorized')
  }

  if (userStore.user.role.sendType === 'ban') {
    return t('sendBanned')
  }

  if (userStore.user.role.sendType === 'internal') {
    return t('sendInternal')
  }

  if (!userStore.user.role.sendCount) {
    return t('unlimited')
  }

  if (userStore.user.role.sendType === 'day') {
    return t('daily')
  }

  if (userStore.user.role.sendType === 'count') {
    return t('total')
  }
})

const sendCount = computed(() => {


  if (!hasPerm('email:send')) {
    return null
  }

  if (userStore.user.role.sendType === 'ban') {
    return null
  }

  if (userStore.user.role.sendType === 'internal') {
    return null
  }

  if (!userStore.user.role.sendCount) {
    return null
  }

  if (settingStore.settings.send === 1) {
    return null
  }

  return userStore.user.sendCount + '/' + userStore.user.role.sendCount
})

async function copyEmail(email) {
  try {
    await navigator.clipboard.writeText(email);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true,
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true,
    })
  }
}

function openNotice() {
  uiStore.showNotice()
}

function openDark(e) {

  const nextIsDark = !uiStore.dark
  const root = document.documentElement

  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    switchDark(nextIsDark, root);
    return
  }

  const x = e.clientX || window.innerWidth / 2
  const y = e.clientY || window.innerHeight / 2

  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  const endRadius = Math.hypot(maxX, maxY)

  // 标记切换目标，供 CSS 选择器使用
  root.setAttribute('data-theme-to', nextIsDark ? 'dark' : 'light')
  root.style.setProperty('--vt-x', `${x}px`)
  root.style.setProperty('--vt-y', `${y}px`)
  root.style.setProperty('--vt-end-radius', `${endRadius + 10}px`)

  const transition = document.startViewTransition(() => {
    switchDark(nextIsDark, root);
  })

  transition.finished.finally(() => {
    // 清理标记
    root.removeAttribute('data-theme-to')
  })
}

function switchDark(nextIsDark, root) {
  root.classList.toggle('dark', nextIsDark)
  const metaTag = document.getElementById('theme-color-meta');
  metaTag?.setAttribute('content', nextIsDark ? '#132122' : '#f4f7f6');
  uiStore.dark = nextIsDark
}

function openSend() {
  uiStore.asideShow = window.innerWidth > 1024 && uiStore.asideShow
  uiStore.writerRef?.open()
}

function changeAside() {
  uiStore.asideShow = !uiStore.asideShow
}

function clickLogout() {
  logoutLoading.value = true
  logout().then(() => {
    localStorage.removeItem("token")
    router.replace('/login')
  }).finally(() => {
    logoutLoading.value = false
  })
}

function formatName(email) {
  return email?.[0]?.toUpperCase() || ''
}

</script>
<style>
.detail-dropdown {
  color: var(--el-text-color-primary) !important;
}
</style>
<style lang="scss" scoped>

:deep(.el-popper.is-pure) {
  border-radius: 6px;
}

.user-details {
  width: 250px;
  font-size: 14px;
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;

  .user-name {
    font-weight: bold;
    margin-top: 10px;
    padding-left: 20px;
    padding-right: 20px;
    width: 250px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
  }

  .detail-user-type {
    margin-top: 10px;
  }

  .action-info {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto;
    margin-top: 10px;

    > div:first-child {
      display: grid;
      align-items: center;
      gap: 10px;
    }

    > div:last-child {
      display: grid;
      gap: 10px;
      text-align: center;

      > div {
        display: flex;
        align-items: center;
      }
    }
  }

  .detail-email {
    padding-left: 20px;
    padding-right: 20px;
    width: 250px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
    color: var(--regular-text-color);
    cursor: pointer;
  }

  .logout {
    margin-top: 20px;
    width: 100%;
    padding-left: 10px;
    padding-right: 10px;
    padding-bottom: 10px;

    .el-button {
      border-radius: 6px;
      height: 28px;
      width: 100%;
    }
  }

  .details-avatar {
    margin-top: 20px;
    height: 40px;
    width: 40px;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    border: 1px solid var(--dark-border);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
  }
}


.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  gap: 20px;
  padding: 0 28px 0 20px;
}
.header-btn { display: flex; align-items: center; gap: 15px; min-width: 0; }
.page-title { display: grid; gap: 3px; min-width: 0; text-align: left; }
.mobile-brand { display: none; }
.breadcrumb-item { font-size: 21px; line-height: 1.25; font-weight: 650; letter-spacing: -.5px; color: var(--mail-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.page-description { font-size: 11px; color: var(--mail-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.workspace-signature { display: flex; align-items: center; gap: 7px; max-width: 140px; margin-right: 7px; padding-right: 16px; border-right: 1px solid var(--mail-border); color: var(--mail-muted); font-size: 10px; font-weight: 550; letter-spacing: .2px; > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
.icon-item {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--regular-text-color);
  cursor: pointer;
  flex-shrink: 0;
  &:hover { background: var(--base-fill); color: var(--mail-accent); }
}
.nav-toggle { width: 30px; height: 34px; }
.mobile-compose { display: none; color: var(--mail-accent); background: var(--el-color-primary-light-9); }
.avatar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 7px;
  cursor: pointer;
  color: var(--mail-muted);
  .avatar-text {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #f3e8d6;
    color: #7c6440;
    font-size: 13px;
    font-weight: 600;
    border: 3px solid var(--mail-surface);
  }
}
@media (max-width: 1024px) {
  .mobile-compose { display: grid; }
  .workspace-signature { display: none; }
  .mobile-brand { display: block; color: var(--mail-muted); font-size: 9px; letter-spacing: .6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
@media (max-width: 767px) {
  .header { padding: 0 15px; gap: 10px; }
  .header-btn { gap: 9px; }
  .breadcrumb-item { font-size: 18px; }
  .page-description { display: none; }
  .toolbar { gap: 4px; }
  .avatar { margin-left: 2px; gap: 0; .setting-icon { display: none; } }
}
</style>
