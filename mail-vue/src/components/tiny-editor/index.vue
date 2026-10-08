<template>
  <div class="editor-box" :class="showLoading || loadError ? 'editor-box-loading' : ''">
    <loading class="loading" v-if="showLoading"/>
    <div v-else-if="loadError" class="editor-error" role="alert">
      <span>{{ locale === 'en' ? 'The editor could not load.' : '编辑器加载失败。' }}</span>
      <button type="button" @click="initializeEditor">{{ locale === 'en' ? 'Try again' : '重新加载' }}</button>
    </div>
    <textarea v-else :id="editorId" ref="editorRef" :aria-label="locale === 'en' ? 'Message content' : '邮件正文'"></textarea>
  </div>
</template>

<script>
// Editor instances share one script request.
let tinyMCEScriptPromise = null
let editorSequence = 0

function ensureTinyMCEScript() {
  if (window.tinymce) return Promise.resolve()
  if (tinyMCEScriptPromise) return tinyMCEScriptPromise

  tinyMCEScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/tinymce/tinymce.min.js'
    script.onload = () => {
      if (window.tinymce) resolve()
      else {
        tinyMCEScriptPromise = null
        script.remove()
        reject(new Error('Editor script did not initialize'))
      }
    }
    script.onerror = () => {
      tinyMCEScriptPromise = null
      script.remove()
      reject(new Error('Editor script could not load'))
    }
    document.head.appendChild(script)
  })
  return tinyMCEScriptPromise
}
</script>

<script setup>
import {ref, onMounted, onBeforeUnmount, watch, nextTick, shallowRef, computed} from 'vue';
import loading from "@/components/loading/index.vue";
import {useI18n} from 'vue-i18n'
import {useUiStore} from '@/store/ui.js'
import {useSettingStore} from '@/store/setting.js'

defineExpose({clearEditor, focus, getContent})

const props = defineProps({
  defValue: {type: String, default: ''},
  editorId: {type: String, default: () => `editor-${Date.now()}-${++editorSequence}`}
})

const {locale} = useI18n()
const emit = defineEmits(['change', 'focus', 'escape'])
const editor = shallowRef(null)
const isInitialized = ref(false)
const editorRef = ref(null)
const showLoading = ref(false)
const loadError = ref(false)
const uiStore = useUiStore()
const settingStore = useSettingStore()
let isMounted = false
let generation = 0
let contentSnapshot = props.defValue
let pendingFocus = false

onMounted(() => {
  isMounted = true
  initializeEditor()
})

onBeforeUnmount(() => {
  isMounted = false
  generation++
  pendingFocus = false
  destroyEditor()
})

watch(() => props.defValue, (newValue) => {
  contentSnapshot = newValue || ''
  if (isInitialized.value && editor.value?.getContent() !== contentSnapshot) {
    editor.value.setContent(contentSnapshot)
  }
})

watch(() => [uiStore.dark, settingStore.lang], () => {
  contentSnapshot = getContent()
  pendingFocus = !!editor.value?.hasFocus()
  destroyEditor()
  initializeEditor()
})

const language = computed(() => locale.value === 'zh' ? 'zh_CN' : 'en')

function clearEditor() {
  contentSnapshot = ''
  pendingFocus = false
  if (isInitialized.value) editor.value?.setContent('')
}

async function initializeEditor() {
  const currentGeneration = ++generation
  const isCurrent = () => isMounted && generation === currentGeneration
  showLoading.value = true
  loadError.value = false

  try {
    await ensureTinyMCEScript()
    if (!isCurrent()) return
    // Mount the textarea only after the script has loaded.
    showLoading.value = false
    await nextTick()
    if (!isCurrent() || !editorRef.value) return

    await window.tinymce.init({
      target: editorRef.value,
      statusbar: false,
      height: '100%',
      forced_root_block: 'div',
      skin: uiStore.dark ? 'oxide-dark' : 'oxide',
      content_css: `/tinymce/css/index.css,${uiStore.dark ? 'dark' : 'default'}`,
      content_style: `:root {
        --scrollbar-track-color: ${uiStore.dark ? '#1b2b2c' : '#FFFFFF'};
        --scrollbar-thumb-color: ${uiStore.dark ? '#78978d' : '#A8ABB2'};
      }`,
      plugins: 'link image advlist lists emoticons fullscreen table preview code',
      toolbar: 'bold emoticons forecolor backcolor italic fontsize | alignleft aligncenter alignright alignjustify | outdent indent | bullist numlist | link image | table code preview fullscreen',
      toolbar_mode: 'scrolling',
      font_size_formats: '8px 10px 12px 14px 16px 18px 24px 36px',
      emoticons_search: false,
      language: language.value,
      language_load: true,
      menubar: false,
      license_key: 'gpl',
      noneditable_class: 'mceNonEditable',
      setup: (ed) => {
        if (isCurrent()) editor.value = ed
        ed.on('init', () => {
          if (!isCurrent()) {
            ed.remove()
            return
          }
          isInitialized.value = true
          ed.setContent(contentSnapshot)
          if (pendingFocus) {
            pendingFocus = false
            ed.focus()
          }
        })
        ed.on('input change undo redo SetContent', () => {
          if (!isCurrent() || !isInitialized.value) return
          contentSnapshot = ed.getContent()
          emit('change', contentSnapshot, ed.getContent({format: 'text'}))
        })
        ed.on('focus', () => emit('focus', focus))
        ed.on('keydown', (event) => {
          if (event.key === 'Escape') emit('escape', event)
        })
      },
      branding: false,
      file_picker_types: 'image',
      image_dimensions: false,
      image_description: false,
      link_title: false,
      dialog_type: 'none',
      file_picker_callback: (callback) => {
        const currentEditor = editor.value
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.addEventListener('change', (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            if (currentEditor !== editor.value || !isInitialized.value) return
            const blobCache = currentEditor.editorUpload.blobCache
            const id = `blobid-${Date.now()}`
            const base64 = reader.result.split(',')[1]
            const blobInfo = blobCache.create(id, file, base64)
            blobCache.add(blobInfo)
            callback(blobInfo.blobUri(), {title: file.name})
          }
          reader.readAsDataURL(file)
        })
        input.click()
      }
    })
  } catch (error) {
    if (!isCurrent()) return
    destroyEditor()
    showLoading.value = false
    loadError.value = true
    console.error('Editor initialization failed:', error)
  }
}

function focus() {
  pendingFocus = true
  nextTick(() => {
    if (!isMounted || !isInitialized.value || !editor.value) return
    pendingFocus = false
    editor.value.focus()
  })
}

function getContent() {
  return isInitialized.value && editor.value ? editor.value.getContent() : contentSnapshot
}

function destroyEditor() {
  isInitialized.value = false
  const previousEditor = editor.value
  editor.value = null
  previousEditor?.remove()
}
</script>

<style lang="scss" scoped>
.editor-box {
  height: 100%;
  width: 100%;
  min-height: 0;
}

.loading {
  margin: auto;
}

.editor-box-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--mail-muted);

  button {
    color: var(--mail-accent);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--el-color-primary-light-9);

    &:focus-visible {
      outline: 2px solid var(--mail-accent);
      outline-offset: 2px;
    }
  }
}

:deep(.tox-tbtn.tox-tbtn--select.tox-tbtn--bespoke) {
  width: 80px !important;
}

:deep(.tox.tox-tinymce.tox-fullscreen) {
  padding-right: 15px;
  padding-left: 15px;
  padding-bottom: 15px;
  background: var(--el-bg-color);
  @media (max-width: 767px) {
    padding-right: 10px;
    padding-left: 10px;
    padding-bottom: 10px;
  }
}

:deep(.tox-tinymce) {
  border: 1px solid var(--mail-border);
  border-radius: 12px;
}

:deep(.tox .tox-editor-header), :deep(.tox .tox-toolbar__primary) {
  background: var(--mail-canvas);
}

:deep(.tox-toolbar__group) {
  padding-left: 0 !important;
  margin: 0 !important;
}

:deep(.tox-tbtn) {
  margin: 0 !important;
}

:deep(.tox .tox-edit-area::before) {
  display: none;
}

</style>
