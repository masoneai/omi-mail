<template>
  <div class="sidebar">
    <div class="brand">
      <span class="brand-mark"><BrandMark :size="29" /></span>
      <div class="brand-copy">
        <strong :title="brandTitle">{{ brandTitle }}</strong>
        <span>{{ copy.brandLine }}</span>
      </div>
      <button class="close-sidebar" :aria-label="copy.close" @click="uiStore.asideShow = false">
        <Icon icon="lucide:x" width="18" />
      </button>
    </div>

    <button v-perm="'email:send'" class="compose-button" aria-keyshortcuts="c" :title="copy.compose + ' (C)'" @click="openSend">
      <Icon icon="lucide:pen-line" width="19" />
      <span>{{ copy.compose }}</span>
      <kbd>C</kbd>
    </button>

    <el-scrollbar class="navigation-scroll">
      <div class="section-title">{{ copy.workspace }}</div>
      <el-menu :default-active="activeName" class="mail-menu">
        <el-menu-item v-for="item in mailboxItems" :key="item.name" :index="item.name" @click="router.push({ name: item.name })">
          <Icon :icon="item.icon" width="19" height="19" />
          <span>{{ $t(item.label) }}</span>
          <span v-if="activeName === item.name" class="active-dot" aria-hidden="true"></span>
        </el-menu-item>
      </el-menu>
      <template v-if="managementItems.length">
        <div class="section-title management-title">{{ $t('manage') }}</div>
        <el-menu :default-active="activeName" class="mail-menu management-menu">
          <el-menu-item v-for="item in managementItems" :key="item.name" :index="item.name" @click="router.push({ name: item.name })">
            <Icon :icon="item.icon" width="18" height="18" />
            <span>{{ $t(item.label) }}</span>
          </el-menu-item>
        </el-menu>
      </template>
    </el-scrollbar>

    <div class="sidebar-footer">
      <div class="domain-card">
        <div class="domain-caption"><Icon icon="lucide:globe-2" width="13" /><span>{{ copy.currentDomain }}</span></div>
        <strong class="domain-name" :title="currentDomain || copy.personalSpace">{{ currentDomain || copy.personalSpace }}</strong>
        <div class="domain-details"><span>{{ copy.domains }}</span><span class="postmark" aria-hidden="true"><Icon icon="lucide:at-sign" width="13" /></span></div>
      </div>
      <span class="footer-note">{{ copy.footerLine }}</span>
    </div>
  </div>
</template>

<script setup>
import router from '@/router/index.js'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/store/setting.js'
import { useUiStore } from '@/store/ui.js'
import { useAccountStore } from '@/store/account.js'
import { useUserStore } from '@/store/user.js'
import BrandMark from '@/components/brand-mark/index.vue'
import { hasPerm } from '@/perm/perm.js'

const settingStore = useSettingStore()
const uiStore = useUiStore()
const accountStore = useAccountStore()
const userStore = useUserStore()
const route = useRoute()
const { locale } = useI18n()
const activeName = computed(() => route.meta.name === 'content' ? 'email' : route.meta.name)
const brandTitle = computed(() => settingStore.settings.title || 'Omi Mail')
const domains = computed(() => [...new Set((settingStore.domainList.length ? settingStore.domainList : settingStore.settings.domainList || [])
  .map(domain => String(domain).replace(/^@/, '')))])
const currentDomain = computed(() => {
  const email = accountStore.currentAccount.email || userStore.user.email || ''
  return email.includes('@') ? email.slice(email.lastIndexOf('@') + 1) : domains.value[0] || ''
})
const copy = computed(() => {
  const count = domains.value.length
  return locale.value.startsWith('en') ? {
    compose: 'Write a letter', close: 'Close navigation', workspace: 'YOUR POSTBOX', personalSpace: 'Your mail space',
    brandLine: 'A LITTLE POST OFFICE.', currentDomain: 'YOUR DOMAIN', footerLine: 'A letter, a connection.',
    domains: `${count} available ${count === 1 ? 'domain' : 'domains'}`
  } : {
    compose: '写一封信', close: '关闭导航', workspace: '我的信箱', personalSpace: '专属邮箱空间',
    brandLine: '一间属于你的邮局', currentDomain: '当前邮域', footerLine: '从一封信，开始连接。', domains: `${count} 个可用域名`
  }
})
const mailboxItems = computed(() => [
  { name: 'email', label: 'inbox', icon: 'lucide:inbox' },
  { name: 'send', label: 'sent', icon: 'lucide:send', perm: 'email:send' },
  { name: 'draft', label: 'drafts', icon: 'lucide:file-pen-line', perm: 'email:send' },
  { name: 'star', label: 'starred', icon: 'lucide:star' },
  { name: 'setting', label: 'settings', icon: 'lucide:sliders-horizontal' }
].filter(item => !item.perm || hasPerm(item.perm)))
const managementItems = computed(() => [
  { name: 'analysis', label: 'analytics', icon: 'lucide:chart-pie', perm: 'analysis:query' },
  { name: 'user', label: 'allUsers', icon: 'lucide:users', perm: 'user:query' },
  { name: 'all-email', label: 'allMail', icon: 'lucide:mails', perm: 'all-email:query' },
  { name: 'role', label: 'permissions', icon: 'lucide:shield-check', perm: 'role:query' },
  { name: 'reg-key', label: 'inviteCode', icon: 'lucide:key-round', perm: 'reg-key:query' },
  { name: 'sys-setting', label: 'SystemSettings', icon: 'lucide:settings', perm: 'setting:query' }
].filter(item => hasPerm(item.perm)))
function openSend() {
  if (window.innerWidth <= 1024) uiStore.asideShow = false
  uiStore.writerRef?.open()
}
</script>

<style lang="scss" scoped>
.sidebar {
  width: var(--mail-sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--aside-backgound);
  color: #ecf7f3;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--mail-header-height);
  min-height: var(--mail-header-height);
  padding: 0 22px;
}
.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: #e9f7ee;
  color: #163f3c;
  box-shadow: 0 0 0 1px #d7f0e52b, 0 3px 8px #001f1920;
}
.brand-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
  strong { font-size: 17px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -.3px; }
  > span { font-size: 8px; letter-spacing: 1px; color: #b2c9c4; white-space: nowrap; }
}
.close-sidebar { display: none; color: #d4e9e2; cursor: pointer; }
.compose-button {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 18px 26px;
  padding: 14px 16px;
  border-radius: 12px;
  color: #143c35;
  background: #bce9d9;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 5px 18px #081f2020;
  transition: background 160ms, transform 160ms;
  > span { flex: 1; text-align: left; }
  kbd { font-size: 11px; font-family: inherit; border: 1px solid #739d8e60; border-radius: 4px; padding: 0 4px; opacity: .7; }
  &:hover { background: #d0f0e4; transform: translateY(-1px); }
}
.navigation-scroll { flex: 1; min-height: 0; }
.section-title { padding: 0 29px 9px; font-size: 10px; font-weight: 600; letter-spacing: 1.5px; color: #8daea7; }
.management-title { margin-top: 26px; }
.mail-menu {
  width: 100%;
  background: transparent;
  border: 0;
  --el-menu-text-color: #b9ceca;
  --el-menu-active-color: #effcf5;
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: #ffffff0b;
  .el-menu-item {
    margin: 3px 18px;
    height: 43px;
    padding: 0 13px !important;
    gap: 12px;
    border-radius: 10px;
    font-size: 13px;
    line-height: normal;
    > svg { flex-shrink: 0; }
    &.is-active { background: var(--aside-menu-active-background); font-weight: 600; box-shadow: inset 3px 0 #bce9d9; }
  }
}
.management-menu .el-menu-item { height: 36px; font-size: 12px; }
.active-dot { width: 5px; height: 5px; border-radius: 50%; margin-left: auto; background: #bce9d9; }
.sidebar-footer {
  display: grid;
  gap: 10px;
  flex-shrink: 0;
  margin: 16px 18px 18px;
}
.domain-card { display: grid; gap: 7px; min-width: 0; padding: 12px 13px 10px; border: 1px dashed #b6ded43b; border-radius: 10px; background: #ffffff04; }
.domain-caption { display: flex; align-items: center; gap: 6px; color: #94bdb1; font-size: 9px; letter-spacing: .75px; }
.domain-name { font-size: 12px; color: #e2f1ea; font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.domain-details { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #9abbb2; font-size: 9px; }
.postmark { display: grid; place-items: center; width: 23px; height: 23px; border-radius: 50%; border: 1px solid #94bdb15b; transform: rotate(-12deg); color: #b8dbcc; }
.footer-note { color: #829f97; font-size: 9px; text-align: center; letter-spacing: .3px; }
@media (max-width: 1024px) {
  .brand { padding: 0 16px; gap: 9px; }
  .brand-copy { flex: 1; }
  .close-sidebar { display: flex; padding: 5px; }
}
@media (max-height: 730px) {
  .compose-button { margin-bottom: 16px; }
  .management-title { margin-top: 16px; }
  .sidebar-footer { margin-top: 12px; margin-bottom: 12px; }
  .domain-card { gap: 5px; padding-top: 10px; padding-bottom: 8px; }
  .footer-note { display: none; }
}
</style>
