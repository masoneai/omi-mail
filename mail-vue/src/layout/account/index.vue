<template>
  <div class="account-box">
    <div class="account-heading">
      <div class="heading-label">
        <span class="eyebrow">{{ copy.workspace }}</span>
        <h2>{{ copy.myMailboxes }}</h2>
      </div>
      <button class="icon-button refresh" type="button" :title="copy.refresh" :aria-label="copy.refresh"
              :disabled="loading || followLoading" @click="refresh">
        <Icon icon="lucide:rotate-cw" width="16" height="16" :class="{'is-spinning': loading || followLoading}"/>
      </button>
      <button class="icon-button drawer-close" type="button" :title="copy.closeMailboxes" :aria-label="copy.closeMailboxes" @click="closeDrawer">
        <Icon icon="lucide:x" width="18" height="18"/>
      </button>
    </div>
    <button v-perm="'account:add'" class="add-mailbox" type="button" @click="add">
      <Icon icon="lucide:plus" width="17" height="17"/>
      <span>{{ $t('addAccount') }}</span>
    </button>
    <el-scrollbar class="scrollbar" ref="scrollbarRef">
      <div class="account-list" v-infinite-scroll="getAccountList" :infinite-scroll-distance="600" :infinite-scroll-immediate="false">
        <article class="item" :class="itemBg(item.accountId)" v-for="(item, index) in accounts" :key="item.accountId">
          <button class="account-select" type="button" :aria-pressed="accountStore.currentAccountId === item.accountId"
                  :title="item.email" @click="changeAccount(item, true)">
            <span class="account-monogram">{{ emailParts(item.email).prefix.charAt(0).toUpperCase() }}</span>
            <span class="account-identity">
              <span class="account-prefix">{{ emailParts(item.email).prefix }}</span>
              <span class="account-domain">@{{ emailParts(item.email).domain }}</span>
            </span>
            <Icon v-if="accountStore.currentAccountId === item.accountId" class="selected-check" icon="lucide:check" width="16" height="16"/>
          </button>
          <div class="account-actions">
            <button class="receive-mode" :class="{'receive-all': item.allReceive}" type="button"
                    :title="item.allReceive ? copy.aggregateOn : copy.aggregateOff"
                    :aria-pressed="Boolean(item.allReceive)" :disabled="allReceiveLoading !== null" @click="setAllReceive(item)">
              <Icon :icon="item.allReceive ? 'lucide:layers' : 'lucide:inbox'" width="14" height="14"/>
              <span>{{ item.allReceive ? copy.aggregate : copy.individual }}</span>
            </button>
            <div class="settings">
              <button class="icon-button" type="button" :title="copy.copyAddress" :aria-label="copy.copyAddress + ' ' + item.email" @click="copyAccount(item.email)">
                <Icon icon="lucide:copy" width="15" height="15"/>
              </button>
              <el-dropdown v-if="!showNullSetting(item)" trigger="click">
                <button class="icon-button" type="button" :title="copy.mailboxOptions" :aria-label="copy.mailboxOptions + ' ' + item.email">
                  <Icon icon="lucide:ellipsis" width="17" height="17"/>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="hasPerm('email:send')" @click="openSetName(item)">{{ $t('rename') }}</el-dropdown-item>
                    <el-dropdown-item v-if="item.accountId !== userStore.user.account.accountId" @click="setAsTop(item, index)">{{ $t('pin') }}</el-dropdown-item>
                    <el-dropdown-item v-if="item.accountId !== userStore.user.account.accountId && hasPerm('account:delete')" @click="remove(item)">{{ $t('delete') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </article>
        <template v-if="loading">
          <el-skeleton v-for="i in skeletonRows" :key="i" class="account-skeleton" animated>
            <template #template>
              <el-skeleton-item variant="circle" style="width: 34px; height: 34px"/>
              <div class="skeleton-copy"><el-skeleton-item variant="text"/><el-skeleton-item variant="text" style="width: 70%"/></div>
            </template>
          </el-skeleton>
        </template>
        <el-skeleton v-if="accounts.length > 0 && !noLoading" class="account-skeleton" animated>
          <template #template><el-skeleton-item variant="text" style="width: 75%"/></template>
        </el-skeleton>
        <div class="list-footnote" v-if="noLoading && accounts.length > 0">
          <span class="footnote-line"></span>{{ copy.mailboxesEnd }}<span class="footnote-line"></span>
        </div>
        <div class="empty-mailboxes" v-if="noLoading && accounts.length === 0">
          <Icon icon="lucide:mail-plus" width="30" height="30"/>
          <p>{{ copy.noMailboxes }}</p>
        </div>
      </div>
    </el-scrollbar>
    <div v-if="domainList.length" class="domain-panel">
      <div class="domain-title"><Icon icon="lucide:globe-2" width="14" height="14"/><span>{{ copy.availableDomains }}</span><span class="domain-count">{{ domainList.length }}</span></div>
      <div class="domain-chips">
        <span v-for="domain in visibleDomains" :key="domain" class="domain-chip" :title="domain.replace(/^@/, '')">{{ domain.replace(/^@/, '') }}</span>
        <span v-if="domainList.length > visibleDomains.length" class="domain-chip" :title="domainList.slice(visibleDomains.length).join(', ')">+{{ domainList.length - visibleDomains.length }}</span>
      </div>
    </div>
    <el-dialog v-model="showAdd" :title="$t('addAccount')" class="mailbox-dialog">
      <p class="dialog-intro">{{ copy.newMailboxHint }}</p>
      <div class="new-mailbox-fields">
        <label class="field-label"><span>{{ copy.addressPrefix }}</span><el-input v-model="addForm.email" ref="addRef" type="text" :placeholder="copy.prefixPlaceholder" autocomplete="off" @keyup.enter="submit"/></label>
        <label class="field-label domain-field"><span>{{ copy.domain }}</span><el-select v-model="addForm.suffix" :placeholder="$t('select')"><el-option v-for="item in domainList" :key="item" :label="item" :value="item"/></el-select></label>
      </div>
      <div class="address-preview"><Icon icon="lucide:at-sign" width="16" height="16"/><span>{{ (addForm.email || 'hello') + (addForm.suffix || '') }}</span></div>
      <el-button class="btn" type="primary" @click="submit" :loading="addLoading">{{ $t('add') }}</el-button>
      <div class="add-email-turnstile" :class="verifyShow ? 'turnstile-show' : 'turnstile-hide'" :data-sitekey="settingStore.settings.siteKey" data-callback="onTurnstileSuccess" data-error-callback="onTurnstileError">
        <span style="font-size: 12px;color: #F56C6C" v-if="botJsError">{{ $t('verifyModuleFailed') }}</span>
      </div>
    </el-dialog>
    <el-dialog v-model="setNameShow" :title="$t('changeUserName')">
      <div class="container">
        <el-input v-model="accountName" type="text" :placeholder="$t('username')" autocomplete="off" @keyup.enter="setName"/>
        <el-button class="btn" type="primary" @click="setName" :loading="setNameLoading">{{ $t('save') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script setup>
import {Icon} from "@iconify/vue";
import {computed, nextTick, reactive, ref, watch} from "vue";
import {
  accountList,
  accountAdd,
  accountDelete,
  accountSetName,
  accountSetAllReceive,
  accountSetAsTop
} from "@/request/account.js";
import {sleep} from "@/utils/time-utils.js"
import {isEmail} from "@/utils/verify-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useUserStore} from "@/store/user.js";
import {useUiStore} from "@/store/ui.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {AccountAllReceiveEnum} from "@/enums/account-enum.js";

const {t, locale} = useI18n();
const userStore = useUserStore();
const uiStore = useUiStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const emailStore = useEmailStore();
const showAdd = ref(false)
const addLoading = ref(false);
const domainList = computed(() => settingStore.domainList)
const visibleDomains = computed(() => domainList.value.slice(0, 4))
const copy = computed(() => locale.value.startsWith('zh') ? {
  workspace: '邮箱空间', myMailboxes: '我的邮箱', refresh: '刷新邮箱', closeMailboxes: '关闭邮箱列表',
  copyAddress: '复制邮箱地址', mailboxOptions: '邮箱选项', individual: '独立收件', aggregate: '汇总收件',
  aggregateOn: '当前汇总全部邮箱的邮件；点击切换到独立收件', aggregateOff: '当前仅显示此邮箱的邮件；点击汇总全部邮箱',
  mailboxesEnd: '每个地址，都有自己的空间', noMailboxes: '还没有邮箱地址', availableDomains: '可用域名',
  newMailboxHint: '选一个邮箱前缀和域名，为不同用途创建专属地址。', addressPrefix: '邮箱前缀',
  prefixPlaceholder: '例如 hello', domain: '选择域名'
} : {
  workspace: 'Your workspace', myMailboxes: 'My mailboxes', refresh: 'Refresh mailboxes', closeMailboxes: 'Close mailbox list',
  copyAddress: 'Copy address', mailboxOptions: 'Mailbox options', individual: 'This mailbox', aggregate: 'All mailboxes',
  aggregateOn: 'Showing mail from all your mailboxes. Click to show this mailbox only.', aggregateOff: 'Showing this mailbox only. Click to show all your mailboxes.',
  mailboxesEnd: 'A place for every address', noMailboxes: 'No mailboxes yet', availableDomains: 'Available domains',
  newMailboxHint: 'Choose a prefix and a domain to create an address for any part of your day.', addressPrefix: 'Address prefix',
  prefixPlaceholder: 'e.g. hello', domain: 'Choose a domain'
})
const accounts = reactive([])
const noLoading = ref(false)
const loading = ref(false)
const followLoading = ref(false);
const allReceiveLoading = ref(null);
const verifyShow = ref(false)
const setNameShow = ref(false)
const setNameLoading = ref(false)
const accountName = ref(null)
const addRef = ref({})
const scrollbarRef = ref({})
let account = null
let turnstileId = null
const botJsError = ref(false)
let verifyToken = ''
let verifyErrorCount = 0
const addForm = reactive({
  email: '',
  suffix: settingStore.domainList[0]
})
let skeletonRows = 10
const queryParams = {
  size: 30
}

if (hasPerm('account:query')) {
  getAccountList()
}

watch(() => accountStore.changeUserAccountName, () => {
  const primaryAccount = accounts.find(item => item.accountId === userStore.user.account.accountId)
  if (primaryAccount) primaryAccount.name = accountStore.changeUserAccountName
})

watch(() => settingStore.domainList, (list) => {
  if (!list.includes(addForm.suffix) && list.length > 0) {
    addForm.suffix = list[0]
  }
}, {immediate: true})


function emailParts(email = '') {
  const separator = email.lastIndexOf('@')
  return {prefix: separator < 0 ? email : email.slice(0, separator), domain: separator < 0 ? '' : email.slice(separator + 1)}
}

function closeDrawer() {
  uiStore.accountShow = false
}

window.onTurnstileError = (e) => {
  if (verifyErrorCount >= 4) {
    return
  }
  verifyErrorCount++
  console.warn('人机验加载失败', e)
  setTimeout(() => {
    nextTick(() => {
      if (!turnstileId) {
        turnstileId = window.turnstile.render('.add-email-turnstile')
      } else {
        window.turnstile.reset(turnstileId);
      }
    })
  }, 1500)
};

window.onTurnstileSuccess = (token) => {
  verifyToken = token;
};

function getSkeletonRows() {
  if (accounts.length > 20) return skeletonRows = 20
  if (accounts.length === 0) return skeletonRows = 1
  skeletonRows = accounts.length
}

function setName() {

  if (setNameLoading.value) return

  let name = accountName.value

  if (name === account.name) {
    setNameShow.value = false
    return
  }

  if (!name) {
    ElMessage({
      message: t('emptyUserNameMsg'),
      type: 'error',
      plain: true,
    })
    return;
  }

  setNameLoading.value = true
  accountSetName(account.accountId, name).then(() => {
    account.name = name
    setNameShow.value = false

    if (account.accountId === userStore.user.account.accountId) {
      userStore.user.name = name
    }

    ElMessage({
      message: t('saveSuccessMsg'),
      type: "success",
      plain: true
    })
  }).finally(() => {
    setNameLoading.value = false
  })
}

function openSetName(accountItem) {
  accountName.value = accountItem.name
  account = accountItem
  setNameShow.value = true
}

async function setAllReceive(account) {
  if (allReceiveLoading.value !== null) return
  const nextMode = account.allReceive === AccountAllReceiveEnum.DISABLED ? AccountAllReceiveEnum.ENABLED : AccountAllReceiveEnum.DISABLED
  allReceiveLoading.value = account.accountId
  try {
    await accountSetAllReceive(account.accountId)
    for (const mailbox of accounts) mailbox.allReceive = AccountAllReceiveEnum.DISABLED
    account.allReceive = nextMode
    if (nextMode === AccountAllReceiveEnum.ENABLED) {
      ElMessage({
        message: t('setSuccess'),
        type: 'success',
        plain: true,
      })
    }
    changeAccount(account);
    emailStore.emailScroll?.refreshList();
    emailStore.sendScroll?.refreshList();
  } catch {
    // The request layer displays the error. Leave the saved selection intact.
  } finally {
    allReceiveLoading.value = null
  }
}


function showNullSetting(item) {
  return !hasPerm('email:send') && !(item.accountId !== userStore.user.account.accountId && hasPerm('account:delete'))
}

function itemBg(accountId) {
  return accountStore.currentAccountId === accountId ? 'item-choose' : ''
}



function remove(account) {
  ElMessageBox.confirm(t('delConfirm', {msg: account.email}), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    accountDelete(account.accountId).then(() => {
      const index = accounts.findIndex(item => item.accountId === account.accountId);
      if (index !== -1) accounts.splice(index, 1);
      if (accountStore.currentAccountId === account.accountId) {
        changeAccount(accounts[0] || userStore.user.account)
      }
      if (accounts.length < queryParams.size) {
        getAccountList()
      }
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true,
      })
    })
  });
}

function refresh() {
  if (loading.value || followLoading.value) {
    return
  }
  loading.value = false
  followLoading.value = false
  noLoading.value = false
  queryParams.accountId = 0
  queryParams.lastSort = null
  getSkeletonRows();
  scrollbarRef.value?.setScrollTop?.(0)
  accounts.splice(0, accounts.length)
  getAccountList()
}

function changeAccount(account, closeOnMobile = false) {
  accountStore.currentAccountId = account.accountId
  accountStore.currentAccount = account
  if (closeOnMobile && window.innerWidth < 768) closeDrawer()
}

function add() {
  addForm.suffix = addForm.suffix || settingStore.domainList[0]
  showAdd.value = true
  setTimeout(() => {
    addRef.value.focus()
  }, 100)
}

function setAsTop(account, index) {
  accountSetAsTop(account.accountId).then(() => {
    ElMessage({
      message: t('setSuccess'),
      type: 'success',
      plain: true,
    })

    const [item] = accounts.splice(index, 1);
    accounts.splice(1, 0, item);

  });
}

async function copyAccount(account) {
  try {
    await navigator.clipboard.writeText(account);
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

function getAccountList() {

  if (loading.value || followLoading.value || noLoading.value) return;

  if (accounts.length === 0) {
    loading.value = true
  } else {
    followLoading.value = true
  }

  let start = Date.now();

  const accountId = accounts.length > 0 ? accounts.at(-1).accountId : 0;
  const lastSort = accounts.length > 0 ? accounts.at(-1).sort : null;

  accountList(accountId, queryParams.size, lastSort).then(async list => {

    let end = Date.now();
    let duration = end - start;
    if (duration < 300) {
      await sleep(300 - duration)
    }

    if (list.length < queryParams.size) {
      noLoading.value = true
    }
    accounts.push(...list)
    const selectedAccount = accounts.find(item => item.accountId === accountStore.currentAccountId)
    if (selectedAccount) accountStore.currentAccount = selectedAccount
    else if (!accountStore.currentAccount?.accountId && accounts.length) changeAccount(accounts[0])

    loading.value = false
    followLoading.value = false
  }).catch(() => {
    loading.value = false
    followLoading.value = false
  })
}


function submit() {

  if (addLoading.value) return

  addForm.email = addForm.email.trim()

  if (!addForm.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: "error",
      plain: true
    })
    return
  }

  if (addForm.email.length < settingStore.settings.minEmailPrefix) {
    ElMessage({
      message: t('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!isEmail(addForm.email + addForm.suffix)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: "error",
      plain: true
    })
    return
  }

  if (!verifyToken && (settingStore.settings.addEmailVerify === 0 || (settingStore.settings.addEmailVerify === 2 && settingStore.settings.addVerifyOpen))) {
    if (!verifyShow.value) {
      verifyShow.value = true
      nextTick(() => {
        if (!turnstileId) {
          try {
            turnstileId = window.turnstile.render('.add-email-turnstile')
          } catch (e) {
            botJsError.value = true
            console.log('人机验证js加载失败')
          }
        } else {
          window.turnstile.reset('.add-email-turnstile')
        }
      })
    } else if (!botJsError.value) {
      ElMessage({
        message: t('botVerifyMsg'),
        type: "error",
        plain: true
      })
    }
    return;
  }

  addLoading.value = true
  accountAdd(addForm.email + addForm.suffix, verifyToken).then(account => {
    addLoading.value = false
    addForm.email = ''
    accounts.push(account)
    verifyToken = ''
    settingStore.settings.addVerifyOpen = account.addVerifyOpen
    ElMessage({
      message: t('addSuccessMsg'),
      type: "success",
      plain: true
    })
    verifyShow.value = false
    showAdd.value = false
    userStore.refreshUserInfo()
  }).catch(res => {
    if (res.code === 400) {
      verifyToken = ''
      if (turnstileId) {
        window.turnstile.reset(turnstileId)
      } else {
        nextTick(() => {
          turnstileId = window.turnstile.render('.add-email-turnstile')
        })
      }
      verifyShow.value = true
    }
    addLoading.value = false
  })
}
</script>
<style scoped lang="scss">
.account-box {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--mail-border, var(--el-border-color));
  background: var(--mail-surface, var(--el-bg-color));
  color: var(--mail-text, var(--el-text-color-primary));
}
.account-heading { display: flex; align-items: center; gap: 5px; padding: 24px 18px 17px; }
.heading-label { flex: 1; min-width: 0; }
.eyebrow { display: block; font-size: 10px; letter-spacing: 1.5px; color: var(--mail-muted); text-transform: uppercase; margin-bottom: 5px; }
h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 650; letter-spacing: .1px; }
.icon-button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 29px; height: 29px; padding: 0; border-radius: 7px; color: var(--mail-muted); cursor: pointer; transition: color .16s, background .16s; }
.icon-button:hover { background: var(--mail-canvas); color: var(--mail-accent); }
.icon-button:disabled { opacity: .5; cursor: wait; }
.drawer-close { display: none; }
.add-mailbox { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 16px 15px; padding: 10px 12px; border: 1px dashed var(--mail-border); border-radius: 9px; color: var(--mail-muted); font-size: 12px; font-weight: 550; cursor: pointer; transition: border-color .16s, color .16s, background .16s; }
.add-mailbox:hover { color: var(--mail-accent); border-color: var(--mail-accent); background: color-mix(in srgb, var(--mail-accent) 5%, var(--mail-surface)); }
.scrollbar { flex: 1; min-height: 0; }
.account-list { padding: 0 14px 16px; }
.item { margin-bottom: 10px; border: 1px solid var(--mail-border); border-radius: 11px; background: var(--mail-surface); transition: border-color .16s, background .16s, box-shadow .16s; overflow: hidden; }
.item:hover { border-color: color-mix(in srgb, var(--mail-accent) 45%, var(--mail-border)); }
.item-choose { border-color: color-mix(in srgb, var(--mail-accent) 35%, var(--mail-border)); background: color-mix(in srgb, var(--mail-accent) 5%, var(--mail-surface)); box-shadow: 0 3px 12px color-mix(in srgb, var(--mail-accent) 5%, transparent); }
.account-select { display: flex; align-items: center; width: 100%; gap: 10px; padding: 15px 11px 12px; text-align: left; cursor: pointer; }
.account-monogram { display: grid; place-items: center; width: 33px; height: 33px; border-radius: 10px; flex-shrink: 0; background: var(--mail-canvas); color: var(--mail-muted); font-size: 14px; font-weight: 650; }
.item-choose .account-monogram { color: var(--mail-accent); background: color-mix(in srgb, var(--mail-accent) 11%, var(--mail-surface)); }
.account-identity { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.account-prefix { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 650; font-size: 13px; color: var(--mail-text); }
.account-domain { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 11px; color: var(--mail-muted); }
.selected-check { color: var(--mail-accent); flex-shrink: 0; }
.account-actions { display: flex; justify-content: space-between; align-items: center; padding: 5px 8px 7px; border-top: 1px solid color-mix(in srgb, var(--mail-border) 65%, transparent); gap: 2px; }
.receive-mode { display: flex; align-items: center; gap: 4px; min-height: 29px; padding: 0 5px; border-radius: 6px; font-size: 10px; color: var(--mail-muted); cursor: pointer; }
.receive-mode:hover, .receive-all { color: var(--mail-accent); background: color-mix(in srgb, var(--mail-accent) 6%, transparent); }
.receive-mode:disabled { opacity: .6; cursor: wait; }
.settings { display: flex; align-items: center; gap: 1px; }
.account-skeleton { display: flex; align-items: center; gap: 10px; border: 1px solid var(--mail-border); border-radius: 11px; padding: 16px 12px; margin-bottom: 10px; }
.skeleton-copy { flex: 1; display: flex; flex-direction: column; gap: 9px; }
.list-footnote { display: flex; align-items: center; gap: 7px; justify-content: center; color: var(--mail-muted); opacity: .65; font-size: 10px; padding: 8px 6px; }
.footnote-line { height: 1px; background: var(--mail-border); flex: 1; }
.empty-mailboxes { display: flex; flex-direction: column; align-items: center; color: var(--mail-muted); gap: 12px; padding: 30px 0; }
.empty-mailboxes p { margin: 0; font-size: 12px; }
.domain-panel { flex-shrink: 0; padding: 17px 18px 20px; border-top: 1px solid var(--mail-border); }
.domain-title { display: flex; gap: 6px; align-items: center; font-size: 11px; color: var(--mail-muted); margin-bottom: 10px; }
.domain-count { margin-left: auto; font-size: 10px; min-width: 18px; text-align: center; background: var(--mail-canvas); border-radius: 5px; line-height: 18px; }
.domain-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.domain-chip { font-size: 10px; line-height: 19px; padding: 0 5px; background: var(--mail-canvas); border: 1px solid var(--mail-border); border-radius: 5px; color: var(--mail-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn { width: 100%; margin-top: 17px; }
.dialog-intro { color: var(--mail-muted); font-size: 13px; margin: 0 0 20px; line-height: 1.7; }
.new-mailbox-fields { display: grid; grid-template-columns: 1fr 1.15fr; gap: 12px; }
.field-label { display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: var(--mail-text); }
.domain-field :deep(.el-select) { width: 100%; }
.address-preview { display: flex; align-items: center; gap: 8px; margin-top: 15px; padding: 11px; border: 1px solid var(--mail-border); border-radius: 8px; background: var(--mail-canvas); color: var(--mail-accent); font-size: 12px; overflow-wrap: anywhere; }
:deep(.el-dialog) { width: 430px !important; border-radius: 16px; padding: 24px; }
.add-email-turnstile { margin-top: 15px; }
.turnstile-show { opacity: 1; }
.turnstile-hide { opacity: 0; pointer-events: none; position: fixed; }
.is-spinning { animation: refresh-spin 1s linear infinite; }
@keyframes refresh-spin { to { transform: rotate(360deg); } }
@media (max-width: 767px) { .drawer-close { display: inline-flex; } .account-heading { padding-top: 20px; } }
@media (max-width: 480px) { :deep(.el-dialog) { width: calc(100% - 32px) !important; margin-left: 16px !important; margin-right: 16px !important; padding: 22px; } .new-mailbox-fields { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .is-spinning { animation: none; } }
</style>
