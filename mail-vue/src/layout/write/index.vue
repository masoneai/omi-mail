<template>
  <div class="send mail-composer" v-show="show" role="dialog" aria-modal="true" aria-labelledby="writer-title">
    <div class="write-box">
      <div class="title">
        <div class="title-left">
          <span class="title-text"><Icon icon="hugeicons:quill-write-01" width="24" height="24"/></span>
          <div class="writer-identity">
            <strong id="writer-title">{{ writerTitle }}</strong>
            <div class="sender-line">
              <span class="sender">{{ $t('sender') }}:</span>
              <span class="sender-name">{{ form.name }}</span>
              <span class="send-email">{{ form.sendEmail }}</span>
            </div>
          </div>
        </div>
        <button type="button" class="writer-control close-control" @click="close" :aria-label="closeLabel" :title="closeLabel">
          <Icon icon="material-symbols-light:close-rounded" width="22" height="22"/>
        </button>
      </div>
      <div class="container">
        <el-input-tag ref="recipientInputRef" :aria-label="t('recipient')" :placeholder="recipientPlaceholder" @add-tag="addTagChange" tag-type="primary" @input="inputChange" size="default" v-model="form.receiveEmail" >
          <template #prefix>
            <div class="item-title" >{{ $t('recipient') }}</div>
            <el-select
                ref="mySelect"
                class="write-select"
                popper-class="write-select"
                :show-arrow="false"
                :no-match-text="' '"
                :no-data-text="' '"
                @visible-change="selectStatusChange"
                @change="selectChange"
            >
              <el-option
                  v-for="item in selectRecipientList"
                  :key="item"
                  :label="item"
                  :value="item"
                  style="color: #999896;"
              />
            </el-select>
          </template>
          <template #suffix>
            <button type="button" class="writer-control add-contact" :aria-label="t('recentContacts')" :title="t('recentContacts')" @click.stop="openContacts">
              <Icon icon="fa7-solid:user-plus" width="18" height="18" />
            </button>
          </template>
        </el-input-tag>
        <el-input v-model="form.subject" :aria-label="t('subject')" :placeholder="t('subject')" />
        <tinyEditor :def-value="defValue" ref="editor" @change="change" @focus="focusChange" @escape="handleKeyDown" />
        <div class="button-item">
          <button type="button" class="writer-control att-add" @click="chooseFile" :aria-label="t('attachments')" :title="t('attachments')">
            <Icon icon="iconamoon:attachment-fill" width="22" height="22"/>
          </button>
          <button type="button" class="writer-control att-clear" @click="clearContent" :aria-label="clearLabel" :title="clearLabel">
            <Icon icon="icon-park-outline:clear-format" width="22" height="22"/>
          </button>
          <div class="att-list">
            <div class="att-item" v-for="(item,index) in form.attachments" :key="index">
              <Icon v-bind="getIconByName(item.filename)"/>
              <span class="att-filename">{{ item.filename }}</span>
              <span class="att-size">{{ formatBytes(item.size) }}</span>
              <button type="button" class="writer-control attachment-remove" :aria-label="`${t('delete')} ${item.filename}`" @click="delAtt(index)">
                <Icon icon="material-symbols-light:close-rounded" width="20" height="20"/>
              </button>
            </div>
          </div>
          <div>
            <el-button type="primary" @click="sendEmail" v-if="form.sendType === 'reply'">{{ $t('reply') }}</el-button>
            <el-button type="primary" @click="sendEmail" v-else-if="form.sendType === 'forward'">{{ $t('forward') }}</el-button>
            <el-button type="primary" @click="sendEmail" v-else>{{ $t('send') }}</el-button>
          </div>
        </div>
      </div>
    </div>
    <el-dialog top="10vh" v-model="showContacts" @closed="clearSelectContact" :title="t('recentContacts')">
      <el-table ref="contactsTabRef" row-key="email" :data="contacts" style="height: 445px">
        <el-table-column type="selection" width="32" />
        <el-table-column property="email" :label="t('emailAccount')" >
          <template #default="props">
            <div class="email-row">{{ props.row.email }}</div>
          </template>
        </el-table-column>
        <el-table-column width="55" label="" >
          <template #default>
            <div style="display: flex;">
              <Icon icon="mage:user" style="color: var(--el-text-color-primary)" width="22" height="22" color="#606266" />
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="contacts-bottom">
        <el-button type="default" @click="deleteContact">{{t('clear')}}</el-button>
        <el-button type="primary" @click="chooseContact">{{t('selectContacts')}}</el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script setup>
import tinyEditor from '@/components/tiny-editor/index.vue'
import {h, nextTick, onMounted, onUnmounted, reactive, ref, toRaw, computed, watch} from "vue";
import {Icon} from "@iconify/vue";
import {useUserStore} from "@/store/user.js";
import {emailSend} from "@/request/email.js";
import {isEmail} from "@/utils/verify-utils.js";
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {fileToBase64, formatBytes} from "@/utils/file-utils.js";
import {getIconByName} from "@/utils/icon-utils.js";
import sendPercent from "@/components/send-percent/index.vue"
import {toOssDomain} from "@/utils/convert.js";
import {formatDetailDate} from "@/utils/day.js";
import {useSettingStore} from "@/store/setting.js";
import {userDraftStore} from "@/store/draft.js";
import {useWriterStore} from "@/store/writer.js";
import db from "@/db/db.js";
import dayjs from "dayjs";
import {useI18n} from "vue-i18n";
import router from "@/router/index.js";
import {ElMessageBox} from "element-plus";

defineExpose({
  open,
  openReply,
  openForward,
  openDraft
})

const {t, locale} = useI18n()
const writerStore = useWriterStore();
const draftStore = userDraftStore()
const settingStore = useSettingStore()
const emailStore = useEmailStore();
const accountStore = useAccountStore()
const editor = ref({})
const recipientInputRef = ref(null)
const userStore = useUserStore();
const show = ref(false);
const percent = ref(0)
let percentMessage = null
let sending = false
let closing = false
let previousFocus = null
let backgroundLayout = null
let backgroundWasInert = false
const defValue = ref('')
const contactsTabRef = ref({})
const showContacts = ref(false)
const mySelect = ref()
let selectStatus = false
const backReply = reactive({
  receiveEmail: [],
  subject: '',
  content: '',
  sendType: ''
})
const form = reactive({
  sendEmail: '',
  receiveEmail: [],
  accountId: -1,
  name: '',
  subject: '',
  content: '',
  sendType: '',
  text: '',
  emailId: 0,
  attachments: [],
  draftId: null,
})

const selectRecipientList = ref([])

const contacts = computed(() => writerStore.sendRecipientRecord.map(item => ({email: item})))
const writerTitle = computed(() => form.sendType === 'reply' ? t('reply') : form.sendType === 'forward' ? t('forward') : locale.value === 'en' ? 'New message' : '写一封邮件')
const closeLabel = computed(() => locale.value === 'en' ? 'Close composer' : '关闭写信窗口')
const clearLabel = computed(() => locale.value === 'en' ? 'Clear message' : '清空邮件')
const recipientPlaceholder = computed(() => locale.value === 'en' ? 'Add an address, then press Enter' : '输入邮箱地址，按回车确认')

watch(show, (visible) => {
  if (visible) {
    previousFocus = document.activeElement
    backgroundLayout = document.querySelector('.layout')
    backgroundWasInert = backgroundLayout?.inert || false
    if (backgroundLayout) backgroundLayout.inert = true
  } else {
    releaseBackground()
    if (previousFocus?.isConnected) previousFocus.focus()
    previousFocus = null
  }
}, {flush: 'post'})

function releaseBackground() {
  if (backgroundLayout) backgroundLayout.inert = backgroundWasInert
  backgroundLayout = null
}

function focusComposer() {
  nextTick(() => {
    if (!show.value) return
    if (form.receiveEmail.length > 0) editor.value.focus()
    else recipientInputRef.value?.focus()
  })
}

function openContacts() {
  showContacts.value = true
  nextTick(() => {
    form.receiveEmail.forEach(item => {
      if (writerStore.sendRecipientRecord.includes(item)) {
        contactsTabRef.value.toggleRowSelection({email: item});
      }
    })
  })
}

function deleteContact() {
  ElMessageBox.confirm(t('confirmDeletionOfContacts'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    const contactList = contactsTabRef.value.getSelectionRows().map(item => item.email);
    form.receiveEmail = form.receiveEmail.filter(item => !contactList.includes(item));
    writerStore.sendRecipientRecord = writerStore.sendRecipientRecord.filter(item => !contactList.includes(item));
  })
}

function chooseContact() {

  const contactList = contactsTabRef.value.getSelectionRows().map(item => item.email);
  contactList.forEach(item => {
    if (!form.receiveEmail.includes(item)) {
      form.receiveEmail.push(item);
    }
  })

  form.receiveEmail = form.receiveEmail.filter(item => {
    return contactList.includes(item) || !writerStore.sendRecipientRecord.includes(item);
  });

  showContacts.value = false
}

function clearSelectContact() {
  contactsTabRef.value.clearSelection();
}

function selectChange(value) {
  form.receiveEmail.push(value)
}

function selectStatusChange(status) {
  selectStatus = status
}

const openSelect = () => {
  mySelect.value.toggleMenu()
}

function inputChange(value) {

  selectRecipientList.value = writerStore.sendRecipientRecord.filter(item => value && !form.receiveEmail.includes(item) && item.startsWith(value)).slice(0, 10);

  if (!selectStatus && selectRecipientList.value.length > 0) {
    openSelect()
  }

  if (selectStatus && selectRecipientList.value.length === 0) {
    openSelect()
  }

}

function addTagChange(val) {

  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  form.receiveEmail.splice(form.receiveEmail.length - 1, 1)

  let has = false
  emails.forEach(email => {
    if (isEmail(email) && !form.receiveEmail.includes(email)) {
      form.receiveEmail.push(email)
      has = true
    }
  })
  if (selectStatus && has) openSelect()
}

function clearContent() {
  ElMessageBox.confirm(t('clearContentConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    resetForm()
  })

}

function delAtt(index) {
  form.attachments.splice(index, 1);
}

function chooseFile() {
  const doc = document.createElement("input")
  doc.setAttribute("type", "file")
  doc.multiple = true;
  doc.onchange = async (e) => {

    const fileList = e.target.files;

    for (const file of fileList) {

      const size = file.size
      const filename = file.name
      const contentType = file.type

      const content = await fileToBase64(file)
      form.attachments.push({content, filename, size, contentType})

    }

  }
  doc.click()
}

async function sendEmail() {

  if (form.receiveEmail.length === 0) {
    ElMessage({
      message: t('emptyRecipientMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!form.subject) {
    ElMessage({
      message: t('emptySubjectMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!form.content) {
    form.content = editor.value.getContent();
  }

  if (!form.content) {
    ElMessage({
      message: t('emptyContentMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.manyType === 'divide' && form.attachments.length > 0) {
    ElMessage({
      message: t('noSeparateSendMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (sending) {
    ElMessage({
      message: t('sendingErrorMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  percentMessage = ElMessage({
    message: () => h(sendPercent, {value: percent.value, desc: t('sending')}),
    dangerouslyUseHTMLString: true,
    plain: true,
    duration: 0,
    customClass: 'message-bottom'
  })

  sending = true

  show.value = false

  emailSend(form, (e) => {
    percent.value = Math.round((e.loaded * 98) / e.total)
  }).then(emailList => {
    const email = emailList[0]
    emailList.forEach(item => {
      emailStore.sendScroll?.addItem(item)
    })

    ElNotification({
      title: t('sendSuccessMsg'),
      type: "success",
      message: h('span', {style: 'color: teal'}, email.subject),
      position: 'bottom-right'
    })

    userStore.refreshUserInfo();

    addRecipientRecord();

    if (form.draftId) {
      form.subject = ''
      form.content = ''
      form.receiveEmail = []
      draftStore.setDraft = {...toRaw(form)}
    }

    show.value = false
    resetForm();
  }).catch((e) => {
    ElNotification({
      title: t('sendFailMsg'),
      type: e.code === 403 ? 'warning' : 'error',
      message: h('span', {style: 'color: teal'}, e.message),
      position: 'bottom-right'
    })
    if (e.code === 401) {
      localStorage.removeItem('token');
      router.replace('/login');
    }
    show.value = true
    addRecipientRecord();
  }).finally(() => {
    percentMessage.close()
    percent.value = 0
    sending = false
  })
}

function addRecipientRecord() {
  writerStore.sendRecipientRecord = writerStore.sendRecipientRecord.filter(
      email => !form.receiveEmail.includes(email)
  );

  writerStore.sendRecipientRecord.unshift(...form.receiveEmail);
  writerStore.sendRecipientRecord = writerStore.sendRecipientRecord.slice(0, 500);
}

function resetForm() {
  form.receiveEmail = []
  form.subject = ''
  form.content = ''
  form.text = ''
  form.manyType = null
  form.attachments = []
  form.sendType = ''
  form.emailId = 0
  form.draftId = null
  backReply.content = ''
  backReply.subject = ''
  backReply.receiveEmail = []
  backReply.sendType = ''
  editor.value.clearEditor()
}

function change(content, text) {
  form.content = content;
  form.text = text
}

function focusChange() {
  if (selectStatus) openSelect()
}

function openForward(email) {
  if (!canOpenWriter()) return
  resetForm();

  email.subject = email.subject || ''

  form.subject = email.subject
  form.sendType = 'forward'

  defValue.value = ''

  setTimeout(() => {
    defValue.value = `
      ${formatImage(email.content) || `<pre style="font-family: inherit;word-break: break-word;white-space: pre-wrap;margin: 0">${email.text}</pre>`}
    `
    open()

    nextTick(() => {
      backReply.content = editor.value.getContent()
      backReply.subject = form.subject
      backReply.receiveEmail = form.receiveEmail
      backReply.sendType = form.sendType
    })

  });
}

function openReply(email) {
  if (!canOpenWriter()) return
  resetForm();

  email.subject = email.subject || ''

  form.receiveEmail.push(email.sendEmail)
  form.subject = (
      email.subject.startsWith('Re:') ||
      email.subject.startsWith('Re：') ||
      email.subject.startsWith('回复：') ||
      email.subject.startsWith('回复:')) ? email.subject : 'Re: ' + email.subject
  form.sendType = 'reply'
  form.emailId = email.emailId

  defValue.value = ''

  setTimeout(() => {
    defValue.value = `
    <div></div>
    <div>
    <br>
        ${formatDetailDate(email.createTime)} ${email.name} &lt${email.sendEmail}&gt ${t('wrote')}:
    </div>
    <blockquote class="mceNonEditable" style="margin: 0 0 0 0.8ex;border-left: 1px solid rgb(204,204,204);padding-left: 1ex;">
      <articl>
          ${formatImage(email.content) || `<pre style="font-family: inherit;word-break: break-word;white-space: pre-wrap;margin: 0">${email.text}</pre>`}
      </article>
    </blockquote>`
    open()

    nextTick(() => {
      backReply.content = editor.value.getContent()
      backReply.subject = form.subject
      backReply.receiveEmail = form.receiveEmail
      backReply.sendType = form.sendType
    })
  })

}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function canOpenWriter() {
  if (!sending) return true
  ElMessage({message: t('sendingErrorMsg'), type: 'info', plain: true})
  return false
}

function open() {
  if (!canOpenWriter()) return
  if (!accountStore.currentAccount.email) {
    form.sendEmail = userStore.user.email;
    form.accountId = userStore.user.account.accountId;
    form.name = userStore.user.name;
  } else {
    form.sendEmail = accountStore.currentAccount.email;
    form.accountId = accountStore.currentAccount.accountId;
    form.name = accountStore.currentAccount.name;
  }
  show.value = true;
  focusComposer()
}

function openDraft(draft) {
  if (!canOpenWriter()) return
  Object.assign(form, {...draft})
  const draftContent = form.content
  defValue.value = ''
  setTimeout(() => defValue.value = draftContent)
  show.value = true;
  focusComposer()
}

const handleKeyDown = (event) => {
  if (!show.value || event.key !== 'Escape' || showContacts.value || selectStatus) return
  if (document.querySelector('.el-message-box, .tox-dialog')) return
  event.preventDefault()
  close()
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  releaseBackground()
});

function close() {
  if (!show.value || closing) return
  if (selectStatus) openSelect();

  if (!form.content) {
    form.content = editor.value.getContent();
  }

  if (form.draftId) {
    draftStore.setDraft = {...toRaw(form)}
    show.value = false
    resetForm()
    return;
  }

  if (!(form.content || form.subject || form.receiveEmail.length > 0)) {
    show.value = false
    resetForm()
    return;
  }

  if (backReply.sendType === 'reply' || backReply.sendType === 'forward') {
    let subjectFlag = form.subject === backReply.subject
    let contentFlag = editor.value.getContent() === backReply.content
    let receiveFlag = form.receiveEmail.length === 1 && form.receiveEmail[0] === backReply.receiveEmail[0]
    if (backReply.sendType === 'forward' && form.receiveEmail.length === 0) {
      receiveFlag = true;
    }
    if (subjectFlag && contentFlag && receiveFlag) {
      resetForm();
      close()
      return;
    }
  }

  closing = true
  ElMessageBox.confirm(t('saveDraftConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning',
    distinguishCancelAndClose: true
  }).then(async () => {
    const formData = {...toRaw(form)};
    delete formData.draftId
    delete formData.attachments
    formData.createTime = dayjs().utc().format('YYYY-MM-DD HH:mm:ss');
    const draftId = await db.value.draft.add({...formData})
    db.value.att.add({draftId, attachments: toRaw(form.attachments)})
    draftStore.refreshList++
    show.value = false
    await nextTick(() => {
      resetForm()
    })
  }).catch((action) => {
    if (action === 'cancel') {
      show.value = false
      resetForm()
    }
  }).finally(() => {
    closing = false
  })

}

</script>
<style>
.write-select .el-select-dropdown__list {
  padding: 4px 4px !important;
}
.write-select .el-select-dropdown__item {
  padding: 0 10px 0 10px;
}

.write-select .el-select-dropdown {
  min-width: 0 !important;
}
</style>
<style scoped lang="scss">
.send {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: rgba(14, 38, 37, .38);
  backdrop-filter: blur(4px);
}

.write-box {
  background: var(--mail-surface);
  color: var(--mail-text);
  width: min(960px, 100%);
  height: min(760px, calc(100dvh - 64px));
  border: 1px solid var(--mail-border);
  box-shadow: 0 24px 80px rgba(8, 35, 31, .22);
  padding: 24px;
  border-radius: var(--mail-radius);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.title-text {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--el-color-primary-light-9);
  color: var(--mail-accent);
}

.writer-identity {
  display: grid;
  gap: 4px;
  min-width: 0;

  strong {
    font-size: 17px;
    font-weight: 650;
  }
}

.sender-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  min-width: 0;
  color: var(--mail-muted);
}

.sender {
  flex-shrink: 0;
}

.sender-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--mail-text);
}

.send-email {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.container {
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 14px;

  :deep(.el-input__wrapper), :deep(.el-input-tag) {
    min-height: 42px;
    border-radius: 10px;
    background: var(--mail-canvas);
  }

  :deep(.el-input-tag) {
    padding-top: 5px;
    padding-bottom: 5px;
  }
}

.item-title {
  color: var(--mail-muted);
  padding: 0 6px;
}

.writer-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  color: var(--mail-muted);
  cursor: pointer;
  transition: background .15s, color .15s;

  &:hover {
    background: var(--mail-canvas);
    color: var(--mail-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--mail-accent);
    outline-offset: 2px;
  }
}

.close-control {
  margin-top: -3px;
  margin-right: -4px;
}

.add-contact {
  width: 28px;
  height: 28px;
}

.button-item {
  display: grid;
  grid-template-columns: 34px 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  border-top: 1px solid var(--mail-border);
  padding-top: 14px;

  .el-button {
    height: 38px;
    padding: 0 24px;
    border-radius: 10px;
    font-weight: 600;
  }
}

.att-list {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  padding: 0 8px;
  max-height: 100px;
  overflow-y: auto;
}

.att-item {
  display: grid;
  align-items: center;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 5px;
  min-height: 34px;
  font-size: 12px;
  padding: 4px 6px;
  background: var(--mail-canvas);
  border: 1px solid var(--mail-border);
  border-radius: 8px;
}

.att-filename {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.att-size {
  color: var(--mail-muted);
}

.attachment-remove {
  width: 24px;
  height: 24px;
}

.email-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-dialog) {
  width: 420px !important;
}

.contacts-bottom {
  display: flex;
  justify-content: end;
  margin-top: 10px;
}

.write-select {
  position: absolute;
  width: 300px;
  left: 60px;
  z-index: 0;
  opacity: 0;
  pointer-events: none;
}

:deep(.el-input-tag__suffix) {
  padding-right: 4px;
}

@media (max-width: 767px) {
  .send {
    padding: 0;
  }

  .write-box {
    width: 100%;
    height: 100dvh;
    border: 0;
    border-radius: 0;
    padding: 16px;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }

  .title {
    margin-bottom: 16px;
  }

  .sender-name {
    display: none;
  }

  .button-item {
    grid-template-columns: 32px 32px minmax(0, 1fr) auto;
    gap: 3px;

    .el-button {
      padding: 0 18px;
    }
  }

  .att-list {
    grid-template-columns: repeat(auto-fill, minmax(125px, 1fr));
    max-height: 90px;
    padding: 0 4px;
  }

  .att-item {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .att-size {
    display: none;
  }
}

@media (max-width: 460px) {
  :deep(.el-dialog) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}
</style>
