<template>
  <el-container class="layout">
    <el-aside
        class="aside"
        :class="uiStore.asideShow ? 'aside-show' : 'el-aside-hide'">
      <Aside />
    </el-aside>
    <div
        :class="(uiStore.asideShow && isMobile)? 'overlay-show':'overlay-hide'"
        @click="uiStore.asideShow = false"
    ></div>
    <el-container class="main-container">
      <el-main>
        <el-header>
            <Header />
        </el-header>
        <Main />
      </el-main>
    </el-container>
  </el-container>
  <writer ref="writerRef" />
</template>

<script setup>
import Aside from '@/layout/aside/index.vue'
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {useUiStore} from "@/store/ui.js";
import {hasPerm} from "@/perm/perm.js";
import writer from '@/layout/write/index.vue'

const uiStore = useUiStore();
const writerRef = ref({})
const isMobile = ref(window.innerWidth < 1025)
const handleResize = () => {
  isMobile.value = window.innerWidth < 1025
  uiStore.asideShow = window.innerWidth > 1024;
}

function handleShortcut(event) {
  if (event.key === 'Escape' && isMobile.value) {
    uiStore.asideShow = false
    uiStore.accountShow = false
    return
  }
  const target = event.target
  const isEditing = target instanceof Element && (
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
  )
  const hasOpenDialog = [...document.querySelectorAll('.el-overlay, .mail-composer')].some(element =>
    element.getClientRects().length > 0
  )
  if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !event.repeat && !isEditing && !hasOpenDialog && hasPerm('email:send')) {
    event.preventDefault()
    uiStore.writerRef?.open()
  }
}

onMounted(() => {
  uiStore.writerRef = writerRef

  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleShortcut)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleShortcut)
  uiStore.writerRef = null
})
</script>

<style lang="scss" scoped>
.el-aside-hide {
  position: fixed;
  left: 0;
  height: 100%;
  z-index: 100;
  transform: translateX(-100%);
  visibility: hidden;
  pointer-events: none;
  transition: all 100ms ease;
}

.aside-show {
  -webkit-box-shadow: var(--aside-right-border);
  box-shadow: var(--aside-right-border);
  transform: translateX(0);
  transition: all 100ms ease;
  z-index: 101;
  @media (max-width: 1024px) {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 101;
    height: 100%;
    background: var(--el-bg-color);
  }
}

.el-aside {
  width: var(--mail-sidebar-width);
  transition: all 100ms ease;
}

.layout {
  height: 100%;
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
}

.main-container {
  min-width: 0;
  min-height: 100%;
  background: var(--mail-canvas);
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

.el-main {
  padding: 0;
  min-width: 0;
  overflow: hidden;
}

.el-header {
  height: var(--mail-header-height);
  background: var(--mail-canvas);
  border-bottom: solid 1px var(--mail-border);
  padding: 0 0 0 0;
}

.overlay-show {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  transition: all 0.3s;
}

.overlay-hide {
  display: flex;
  pointer-events: none;
  opacity: 0;
}
</style>
