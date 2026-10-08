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
      <el-tooltip ref="accountPopover" trigger="click" effect="light" placement="bottom-end" role="dialog" :aria-label="copy.accountCard" @before-show="userInfoShow = true" @before-hide="userInfoShow = false" @show="focusAccountCard" :teleported="false" :show-arrow="false" :hide-after="0" popper-class="detail-dropdown">
        <button ref="accountTrigger" class="avatar" :aria-label="copy.profile + userStore.user.email" :aria-expanded="userInfoShow" aria-haspopup="dialog">
          <div class="avatar-text">
            <div>{{ formatName(userStore.user.email) }}</div>
          </div>
          <Icon class="setting-icon" icon="lucide:chevron-down" width="14" height="14"/>
        </button>
        <template #content>
          <section class="user-details" @keydown.esc.stop.prevent="closeAccountCard">
            <div class="profile-summary">
              <div class="profile-identity">
                <div class="details-avatar" aria-hidden="true">{{ formatName(userStore.user.email) }}</div>
                <div class="identity-copy">
                  <span class="profile-caption">{{ copy.accountCard }}</span>
                  <div class="identity-name">
                    <strong class="user-name" :title="userStore.user.name">{{ userStore.user.name || formatName(userStore.user.email) }}</strong>
                    <span class="role-badge" :title="roleName"><Icon icon="lucide:shield-check" width="12" />{{ roleName }}</span>
                  </div>
                </div>
              </div>
              <button ref="copyAddressButton" class="detail-email" :title="copy.copyAddress" :aria-label="copy.copyAddress + ' ' + userStore.user.email" @click="copyEmail(userStore.user.email)">
                <Icon icon="lucide:at-sign" width="15" aria-hidden="true" />
                <span>{{ userStore.user.email }}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9h11v11H9zM15 9V4H4v11h5" /></svg>
              </button>
            </div>
            <div class="profile-allowances">
              <span class="profile-caption">{{ copy.allowances }}</span>
              <div class="allowance-row">
                <span class="allowance-icon"><Icon icon="lucide:send" width="17" /></span>
                <div class="allowance-label">
                  <span>{{ copy.sending }}</span>
                  <small v-if="sendCount">{{ userStore.user.role.sendType === 'day' ? copy.dailyUsage : copy.totalUsage }}</small>
                </div>
                <div class="allowance-value">
                  <strong v-if="sendCount">{{ sendCount }}</strong>
                  <span v-else class="allowance-status" :class="{ unavailable: sendUnavailable }">{{ sendType }}</span>
                </div>
              </div>
              <div class="allowance-row">
                <span class="allowance-icon"><Icon icon="lucide:inbox" width="17" /></span>
                <span class="allowance-label">{{ copy.addresses }}</span>
                <span class="allowance-status" :class="{ unavailable: accountUnavailable }">{{ accountAllowance }}</span>
              </div>
            </div>
            <div class="profile-actions">
              <button class="profile-action settings-action" @click="openAccountSettings"><Icon icon="lucide:sliders-horizontal" width="16" />{{ copy.accountSettings }}</button>
              <el-button class="profile-action logout-action" :loading="logoutLoading" @click="clickLogout"><svg v-if="!logoutLoading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H4V3h5M10 12h11M17 8l4 4-4 4" /></svg>{{ $t('logOut') }}</el-button>
            </div>
          </section>
        </template>
      </el-tooltip>
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
const accountPopover = ref()
const accountTrigger = ref()
const copyAddressButton = ref()
const brandTitle = computed(() => settingStore.settings.title || 'Omi Mail')
const currentAddress = computed(() => accountStore.currentAccount.email || userStore.user.email || '')

const copy = computed(() => locale.value.startsWith('en') ? {
  navigation: 'Toggle navigation', compose: 'Compose', light: 'Switch to light mode', dark: 'Switch to dark mode',
  notice: 'Announcements', profile: 'Account: ', inbox: 'Letters find their home here.',
  allMail: 'Browse and filter all mail.',
  sent: 'Letters on their way.', draft: 'A letter in the making.', star: 'Letters worth keeping close.',
  setting: 'Arrange your little post office.', management: 'Your domains, addresses and people.',
  accountCard: 'Your account', allowances: 'USAGE & ACCESS', sending: 'Sending', addresses: 'Mailboxes',
  dailyUsage: 'Used today / daily limit', totalUsage: 'Used / total limit', copyAddress: 'Copy email address',
  accountSettings: 'Account settings', adminRole: 'Admin', mailboxLimit: count => `Up to ${count} mailboxes`
} : {
  navigation: '切换导航栏', compose: '写邮件', light: '切换浅色模式', dark: '切换深色模式',
  notice: '查看公告', profile: '账号：', inbox: '每一封来信，都有归处。',
  allMail: '集中查看与筛选全部邮件',
  sent: '寄出的心意，都留在这里。', draft: '一封信，正在酝酿。', star: '值得珍藏的信，随手可见。',
  setting: '布置你的专属邮局。', management: '管理你的域名、地址与成员。',
  accountCard: '我的账号', allowances: '使用权限', sending: '邮件发送', addresses: '邮箱添加',
  dailyUsage: '今日已用 / 每日额度', totalUsage: '累计已用 / 总额度', copyAddress: '复制邮箱地址',
  accountSettings: '账号设置', adminRole: '管理员', mailboxLimit: count => `最多 ${count} 个邮箱`
})
const pageDescription = computed(() => {
  const name = route.meta.name
  if (name === 'all-email') return copy.value.allMail
  if (name === 'content' && ['all-email', 'unified-inbox'].includes(uiStore.messageSource)) {
    return emailStore.contentData.email?.toEmail || copy.value.allMail
  }
  if (['content', 'email', 'send'].includes(name) && currentAddress.value) return currentAddress.value
  const copyName = name === 'email' ? 'inbox' : (name === 'send' ? 'sent' : name)
  return copy.value[copyName] || copy.value.management
})


const accountCount = computed(() => {
  return Number(userStore.user.role.accountCount) || 0
})
const roleName = computed(() => userStore.user.role.name === 'admin' ? copy.value.adminRole : userStore.user.role.name)
const sendUnavailable = computed(() => settingStore.settings.send === 1 || !hasPerm('email:send') || userStore.user.role.sendType === 'ban')
const accountUnavailable = computed(() => !!(settingStore.settings.manyEmail || settingStore.settings.addEmail) || !hasPerm('account:add'))
const accountAllowance = computed(() => {
  if (settingStore.settings.manyEmail || settingStore.settings.addEmail) return t('disabled')
  if (!hasPerm('account:add')) return t('unauthorized')
  return accountCount.value ? copy.value.mailboxLimit(accountCount.value) : t('unlimited')
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

  if (!Number(userStore.user.role.sendCount)) {
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

  if (!Number(userStore.user.role.sendCount)) {
    return null
  }

  if (settingStore.settings.send === 1) {
    return null
  }
  if (userStore.user.role.sendType === 'internal') return null
  return `${Number(userStore.user.sendCount) || 0} / ${Number(userStore.user.role.sendCount)}`
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

function openAccountSettings() {
  accountPopover.value?.hide()
  router.push({name: 'setting'})
}

function focusAccountCard() {
  copyAddressButton.value?.focus()
}

function closeAccountCard() {
  accountPopover.value?.hide()
  accountTrigger.value?.focus()
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
.detail-dropdown.el-popper {
  width: min(320px, calc(100vw - 24px));
  padding: 0;
  color: var(--mail-text);
  background: var(--mail-surface);
  border: 1px solid var(--mail-border);
  border-radius: 18px;
  box-shadow: 0 14px 40px #102f3026, 0 3px 10px #102f300c;
  overflow: hidden;
}
</style>
<style lang="scss" scoped>
.user-details {
  width: 100%;
  max-height: calc(100dvh - 100px);
  overflow-y: auto;
  font-size: 13px;
  text-align: left;
}
.profile-summary { padding: 16px 18px 8px; background: linear-gradient(135deg, var(--base-fill), var(--mail-surface) 85%); }
.profile-identity { display: flex; align-items: center; gap: 12px; }
.details-avatar { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; border-radius: 14px; color: var(--mail-accent); background: var(--el-color-primary-light-9); border: 1px solid var(--el-color-primary-light-7); font-size: 21px; font-weight: 600; }
.identity-copy { min-width: 0; flex: 1; display: grid; gap: 4px; }
.profile-caption { color: var(--mail-muted); font-size: 10px; font-weight: 550; letter-spacing: .5px; }
.identity-name { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; min-width: 0; }
.user-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--mail-text); font-size: 17px; font-weight: 650; line-height: 1.3; }
.role-badge { display: inline-flex; align-items: center; gap: 3px; max-width: 100%; padding: 2px 6px; border-radius: 6px; color: var(--mail-accent); background: var(--el-color-primary-light-9); font-size: 10px; overflow-wrap: anywhere; }
.detail-email { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; margin-top: 4px; padding: 7px 2px; border-radius: 8px; color: var(--el-text-color-regular); cursor: pointer; text-align: left; transition: color .15s, background .15s; > svg { flex-shrink: 0; color: var(--mail-muted); } > span { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 12px; } &:hover { color: var(--mail-accent); background: var(--base-fill); > svg { color: var(--mail-accent); } } }
.profile-allowances { padding: 10px 18px 12px; border-top: 1px solid var(--mail-border); > .profile-caption { display: block; margin-bottom: 6px; } }
.allowance-row { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 4px 0; + .allowance-row { margin-top: 2px; } }
.allowance-icon { display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 10px; color: var(--mail-muted); background: var(--base-fill); }
.allowance-label { display: grid; gap: 2px; flex: 1; min-width: 0; color: var(--mail-text); font-size: 12px; small { color: var(--mail-muted); font-size: 10px; } }
.allowance-value { text-align: right; flex-shrink: 0; strong { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--mail-text); } }
.allowance-status { max-width: 135px; padding: 3px 8px; border-radius: 7px; color: var(--mail-accent); background: var(--el-color-primary-light-9); font-size: 11px; overflow-wrap: anywhere; text-align: right; &.unavailable { color: var(--el-text-color-secondary); background: var(--base-fill); } }
.profile-actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 9px; padding: 10px 14px 12px; border-top: 1px solid var(--mail-border); }
.profile-action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 0; min-height: 44px; height: auto; margin: 0; padding: 9px 8px; border-radius: 10px; border: 1px solid var(--mail-border); background: var(--mail-surface); font-size: 12px; cursor: pointer; white-space: normal; line-height: 1.3; }
.settings-action { color: var(--el-text-color-regular); &:hover { color: var(--mail-accent); background: var(--base-fill); } }
.logout-action { color: var(--el-color-danger); :deep(> span) { display: flex; align-items: center; justify-content: center; gap: 7px; } &:hover { border-color: var(--el-color-danger-light-5); color: var(--el-color-danger); background: var(--el-color-danger-light-9); } }

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
  padding: 3px 4px;
  border-radius: 12px;
  cursor: pointer;
  color: var(--mail-muted);
  transition: background .15s;
  &:hover, &[aria-expanded="true"] { background: var(--base-fill); }
  .setting-icon { transition: transform .15s; }
  &[aria-expanded="true"] .setting-icon { transform: rotate(180deg); }
  .avatar-text {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--el-color-primary-light-9);
    color: var(--mail-accent);
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
