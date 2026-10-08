<template>
  <div v-for="item in rows" :key="item" class="skeleton-row" aria-hidden="true">
    <div :class="'email-row ' + type ">
      <el-checkbox disabled :class=" props.type === 'all-email' ? 'all-email-checkbox' : 'checkbox'"
      ></el-checkbox>
      <div class="pc-star" v-if="showStar">
        <Icon style="color: var(--el-border-color)" icon="solar:star-line-duotone" width="18" height="18"/>
      </div>
      <div v-if="!showStar"></div>
      <div class="title" :class="accountShow ? 'title-column' : 'title-column'">

        <div class="email-sender">
          <div class="email-status" v-if="showStatus">

          </div>
          <div v-else></div>
          <span class="name">
             <span>
               <el-skeleton animated>
                 <template #template>
                   <el-skeleton-item variant="text" class="name-skeleton"/>
                 </template>
               </el-skeleton>
             </span>
             <span></span>
          </span>
          <span class="phone-time">
            <el-skeleton animated>
              <template #template>
                <el-skeleton-item variant="text" style="width: 50px;height: 1rem;"/>
              </template>
            </el-skeleton>
          </span>
        </div>
        <div>
          <div class="email-text-skeleton">
            <el-skeleton animated>
              <template #template>
                <el-skeleton-item variant="text" class="text-skeleton-one"/>
                <el-skeleton-item variant="text" class="text-skeleton-two"/>
              </template>
            </el-skeleton>
          </div>
          <div class="user-info" v-if="showUserInfo">
            <div class="user">
              <el-skeleton animated>
                <template #template>
                  <el-skeleton-item variant="text"
                                    style="width: 180px;margin-right: 5px;height: 1rem;margin-bottom: 4px;"/>
                </template>
              </el-skeleton>
            </div>
            <div class="account">
              <el-skeleton animated>
                <template #template>
                  <el-skeleton-item variant="text"
                                    style="width: 180px;margin-right: 5px;height: 1rem;margin-bottom: 4px;"/>
                </template>
              </el-skeleton>
            </div>

          </div>
        </div>
      </div>
      <div class="email-right-skeleton" :style="showUserInfo ? 'align-self: start;':''">
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="text" style="width: 60px;margin-right: 15px;height: 1rem;"/>
          </template>
        </el-skeleton>
      </div>
    </div>
  </div>
</template>
<script setup>
const props = defineProps({
  rows: {
    type: Number,
    default: 1
  },
  showStar: {
    type: Boolean,
    default: true
  },
  accountShow: {
    type: Boolean,
    default: false
  },
  showStatus: {
    type: Boolean,
    default: false
  },
  showUserInfo: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: ''
  }
})
import {Icon} from "@iconify/vue";
</script>

<style scoped lang="scss">
.skeleton-row { background: var(--mail-surface, var(--el-bg-color)); }
.pc-star { display: inline-flex; align-items: center; justify-content: center; width: 24px; color: var(--mail-border); }
:deep(.el-skeleton__item) { border-radius: 4px; position: relative; top: 2px; }
</style>
