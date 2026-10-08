<template>
  <emailScroll ref="scroll"
               :cancel-success="cancelStar"
               :star-success="addStar"
               :getEmailList="getEmailList"
               :emailDelete="emailDelete"
               :star-add="starAdd"
               :star-cancel="starCancel"
               :time-sort="params.timeSort"
               :email-read="emailRead"
               :show-unread="true"
               :show-account-icon="true"
               actionLeft="4px"
               @jump="jumpContent"
  >
    <template #first>
      <button class="sort-button" @click="changeTimeSort" :title="sortLabel" :aria-label="sortLabel">
        <Icon :icon="params.timeSort === 0 ? 'solar:sort-from-top-to-bottom-linear' : 'solar:sort-from-bottom-to-top-linear'" width="19" height="19" />
      </button>
    </template>

  </emailScroll>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useSettingStore} from "@/store/setting.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete, emailLatest, emailRead} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {computed, defineOptions, onActivated, onDeactivated, onBeforeUnmount, onMounted, reactive, ref, watch} from "vue";
import {useI18n} from "vue-i18n";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import { useRoute } from 'vue-router'

defineOptions({
  name: 'email'
})

const route = useRoute();
const {locale} = useI18n();
const sortLabel = computed(() => locale.value?.startsWith('en') ? (params.timeSort ? 'Oldest first · switch to newest first' : 'Newest first · switch to oldest first') : (params.timeSort ? '旧邮件优先 · 切换为最新优先' : '最新邮件优先 · 切换为旧邮件优先'));
let pollTimer;
let active = true;
let disposed = false;
let pollGeneration = 0;
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const scroll = ref({})
const params = reactive({
  timeSort: 0,
})
const listScope = computed(() => ({
  accountId: accountStore.currentAccountId,
  allReceive: accountStore.currentAccount.allReceive ?? 0
}));
const scopeKey = computed(() => `${listScope.value.accountId}:${listScope.value.allReceive}`);
let lastRequestScopeKey;

// Mailbox changes invalidate the cached list, including requests still loading.
function activateList() {
  active = true;
  emailStore.emailScroll = scroll;
  if (lastRequestScopeKey !== scopeKey.value ||
      (!scroll.value?.firstLoad && scroll.value?.latestEmail?.scopeKey !== scopeKey.value)) {
    scroll.value?.refreshList();
  }
  restartPolling();
}

onMounted(() => {
  emailStore.emailScroll = scroll;
  scheduleLatest();
})
onActivated(activateList);
onDeactivated(() => { active = false; stopPolling(); });
onBeforeUnmount(() => { disposed = true; stopPolling(); });
watch(() => settingStore.settings.autoRefresh, restartPolling);


watch(scopeKey, () => {
  if (!active) return;
  scroll.value?.refreshList();
  restartPolling();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  scroll.value?.refreshList();
  restartPolling();
}

function jumpContent(email) {
  emailStore.contentData.email = emailStore.toContentEmail(email)
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showUnread = true
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  router.push('/mail')
}

function stopPolling() {
  clearTimeout(pollTimer);
  pollGeneration++;
}

function restartPolling() {
  stopPolling();
  scheduleLatest();
}

function scheduleLatest() {
  clearTimeout(pollTimer);
  const interval = Number(settingStore.settings.autoRefresh);
  if (!active || disposed || interval <= 1) return;
  const generation = pollGeneration;
  pollTimer = setTimeout(() => latest(generation), interval * 1000);
}

async function latest(generation) {
  try {
    const expectedRoute = 'email';
    if (disposed || !active || route.name !== expectedRoute || generation !== pollGeneration) return;
    const currentList = scroll.value;
    if (!currentList || currentList.firstLoad) return;
    const { accountId, allReceive } = listScope.value;
    const requestScopeKey = scopeKey.value;
    const curTimeSort = params.timeSort;
    if (requestScopeKey !== currentList.latestEmail?.scopeKey) return;
    const list = await emailLatest(currentList.latestEmail?.emailId || 0, accountId, allReceive);
    if (disposed || !active || generation !== pollGeneration || requestScopeKey !== scopeKey.value || params.timeSort !== curTimeSort || route.name !== expectedRoute) return;
    emailStore.applyFullList(list);
    for (const email of list) {
      email.reqAccountId = accountId;
      email.allReceive = allReceive;
      email.scopeKey = requestScopeKey;
      currentList.addItem(email);
    }
  } catch (error) {
    if (error.code === 401 || error.code === 403) settingStore.settings.autoRefresh = 0;
    console.error(error);
  } finally {
    if (generation === pollGeneration) scheduleLatest();
  }
}

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

function getEmailList(emailId, size) {
  const { accountId, allReceive } = listScope.value;
  const requestScopeKey = scopeKey.value;
  lastRequestScopeKey = requestScopeKey;
  return emailStore.fetchList(full =>
    emailList(accountId, allReceive, emailId, params.timeSort, size, 0, full)
  ).then(data => {
    data.latestEmail.reqAccountId = accountId;
    data.latestEmail.allReceive = allReceive;
    data.latestEmail.scopeKey = requestScopeKey;
    return data;
  })
}

</script>
<style scoped>
.sort-button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px; color: var(--mail-muted, var(--el-text-color-secondary)); cursor: pointer; transition: background .15s, color .15s; }
.sort-button:hover { color: var(--mail-accent, var(--el-color-primary)); background: var(--el-color-primary-light-9); }
</style>
