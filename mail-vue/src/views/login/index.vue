<template>
  <div id="login-box" class="login-page" :class="{ 'login-page--custom': background, 'login-page--dark': uiStore.dark }"
       v-loading="oauthLoading" :element-loading-text="t('authSigningIn')">
    <div v-if="background" class="login-background" :style="background" aria-hidden="true"></div>
    <main class="auth-shell">
      <section class="auth-story" :aria-label="t('authBrandLabel')">
        <div class="auth-brand">
          <BrandMark class="auth-brand-icon" :size="46" />
          <span>{{ settingStore.settings.title || 'Omi Mail' }}</span>
        </div>
        <div class="auth-story-copy">
          <h1>{{ t('authHeroTitle') }}</h1>
          <p>{{ t('authHeroDescription') }}</p>
        </div>
        <img class="auth-illustration" src="/image/login-mail-garden.webp" alt="" width="1254" height="1254" fetchpriority="high" decoding="async" />
        <p class="auth-story-note"><span aria-hidden="true"></span>{{ t('authHeroNote') }}</p>
      </section>

      <section class="auth-card" :style="{ backgroundColor: loginOpacity }" aria-labelledby="auth-form-title">
        <header class="auth-card-heading">
          <span class="auth-eyebrow">{{ show === 'login' ? t('authLoginEyebrow') : t('authRegisterEyebrow') }}</span>
          <h2 id="auth-form-title">{{ show === 'login' ? t('authWelcome') : t('authCreateAccount') }}</h2>
          <p>{{ show === 'login' ? t('authLoginDescription') : t('authRegisterDescription') }}</p>
        </header>

        <form v-show="show === 'login'" class="auth-form" novalidate :aria-busy="loginLoading"
              @submit.prevent="submit" @compositionstart="onCompositionStart" @compositionend="onCompositionEnd">
          <div class="auth-field">
            <label for="login-username">{{ emailLabel }}</label>
            <el-input id="login-username" ref="loginEmailInput" v-model="form.email" :class="{ 'auth-email-input': !hideLoginDomain }"
                      type="text" :placeholder="emailPlaceholder" autocomplete="username" :inputmode="hideLoginDomain ? 'email' : 'text'"
                      autocapitalize="none" :spellcheck="false" enterkeyhint="next" required :disabled="busy"
                      aria-describedby="login-username-hint" @keydown.enter="onFieldEnter($event, 'login', 'email')">
              <template v-if="!hideLoginDomain" #append>
                <el-select v-model="suffix" class="auth-domain-select" :aria-label="t('authDomainLabel')"
                           :placeholder="t('select')" :disabled="busy" @keydown.enter.stop>
                  <el-option v-for="item in domainList" :key="item" :label="item" :value="item" />
                </el-select>
              </template>
            </el-input>
            <span id="login-username-hint" class="auth-field-hint">{{ t('authUsernameHint') }}</span>
          </div>
          <div class="auth-field">
            <label for="login-password">{{ t('password') }}</label>
            <el-input id="login-password" ref="loginPasswordInput" v-model="form.password" type="password" show-password
                      :placeholder="t('authPasswordPlaceholder')" autocomplete="current-password" enterkeyhint="go"
                      required :disabled="busy" @keydown.enter="onFieldEnter($event, 'login', 'password')" />
          </div>
          <el-button class="auth-submit" type="primary" native-type="submit" :loading="loginLoading" :disabled="busy && !loginLoading">
            {{ t('loginBtn') }}<Icon v-if="!loginLoading" icon="mingcute:arrow-right-line" width="18" height="18" aria-hidden="true" />
          </el-button>
        </form>

        <form v-show="show === 'register'" class="auth-form" novalidate :aria-busy="registerLoading"
              @submit.prevent="submitRegister" @compositionstart="onCompositionStart" @compositionend="onCompositionEnd">
          <div class="auth-field">
            <label for="register-username">{{ emailLabel }}</label>
            <el-input id="register-username" ref="registerEmailInput" v-model="registerForm.email" :class="{ 'auth-email-input': !hideLoginDomain }"
                      type="text" :placeholder="emailPlaceholder" autocomplete="username" :inputmode="hideLoginDomain ? 'email' : 'text'"
                      autocapitalize="none" :spellcheck="false" enterkeyhint="next" required :disabled="busy"
                      @keydown.enter="onFieldEnter($event, 'register', 'email')">
              <template v-if="!hideLoginDomain" #append>
                <el-select v-model="suffix" class="auth-domain-select" :aria-label="t('authDomainLabel')"
                           :placeholder="t('select')" :disabled="busy" @keydown.enter.stop>
                  <el-option v-for="item in domainList" :key="item" :label="item" :value="item" />
                </el-select>
              </template>
            </el-input>
          </div>
          <div class="auth-field">
            <label for="register-password">{{ t('password') }}</label>
            <el-input id="register-password" ref="registerPasswordInput" v-model="registerForm.password" type="password" show-password
                      :placeholder="t('authNewPasswordPlaceholder')" autocomplete="new-password" enterkeyhint="next"
                      required :disabled="busy" @keydown.enter="onFieldEnter($event, 'register', 'password')" />
          </div>
          <div class="auth-field">
            <label for="register-confirm">{{ t('confirmPwd') }}</label>
            <el-input id="register-confirm" ref="registerConfirmInput" v-model="registerForm.confirmPassword" type="password" show-password
                      :placeholder="t('authConfirmPasswordPlaceholder')" autocomplete="new-password" :enterkeyhint="hasInviteField ? 'next' : 'go'"
                      required :disabled="busy" @keydown.enter="onFieldEnter($event, 'register', 'confirmPassword')" />
          </div>
          <div v-if="hasInviteField" class="auth-field">
            <label for="register-invite">{{ settingStore.settings.regKey === 0 ? t('regKey') : t('regKeyOptional') }}</label>
            <el-input id="register-invite" ref="registerInviteInput" v-model="registerForm.code" type="text"
                      :placeholder="t('authInvitePlaceholder')" autocomplete="off" enterkeyhint="go" :required="settingStore.settings.regKey === 0"
                      :disabled="busy" @keydown.enter="onFieldEnter($event, 'register', 'code')" />
          </div>
          <div v-show="verifyShow" class="auth-verification" aria-live="polite">
            <div ref="turnstileContainer" class="register-turnstile"></div>
            <p v-if="botJsError" class="auth-verification-error" role="alert">{{ t('verifyModuleFailed') }}</p>
          </div>
          <el-button class="auth-submit" type="primary" native-type="submit" :loading="registerLoading" :disabled="busy && !registerLoading">
            {{ t('regBtn') }}<Icon v-if="!registerLoading" icon="mingcute:arrow-right-line" width="18" height="18" aria-hidden="true" />
          </el-button>
        </form>

        <div v-if="oauthProviders.length" class="auth-oauth">
          <div class="auth-divider"><span>{{ t('authOrContinue') }}</span></div>
          <div class="auth-oauth-buttons">
            <el-button v-for="p in oauthProviders" :key="p.key" class="auth-oauth-button" :disabled="busy" @click="oauthLogin(p.key)">
              <el-avatar v-if="p.iconType === 'image'" :src="p.icon" :size="18" aria-hidden="true" />
              <Icon v-else :icon="p.icon" width="18" height="18" aria-hidden="true" />
              {{ p.label }}
            </el-button>
          </div>
        </div>

        <p v-if="settingStore.settings.register === 0" class="auth-switch">
          {{ show === 'login' ? t('noAccount') : t('hasAccount') }}
          <button type="button" :disabled="busy" @click="switchForm">{{ show === 'login' ? t('regSwitch') : t('loginSwitch') }}</button>
        </p>
        <footer v-if="projectUrl" class="auth-footer">
          <a :href="projectUrl" target="_blank" rel="noopener noreferrer">
            <Icon icon="mingcute:github-line" width="17" height="17" aria-hidden="true" />{{ t('authProjectSource') }}
            <Icon icon="mingcute:external-link-line" width="13" height="13" aria-hidden="true" />
          </a>
        </footer>
      </section>
    </main>

    <el-dialog v-model="showBindForm" class="auth-bind-dialog" :title="t('authBindTitle')" width="440px" append-to-body
               :close-on-click-modal="!bindLoading" :close-on-press-escape="!bindLoading" :show-close="!bindLoading"
               @opened="bindEmailInput?.focus()">
      <p class="auth-bind-description">{{ t('authBindDescription') }}</p>
      <form class="auth-form" novalidate :aria-busy="bindLoading" @submit.prevent="bind"
            @compositionstart="onCompositionStart" @compositionend="onCompositionEnd">
        <div class="auth-field">
          <label for="bind-username">{{ emailLabel }}</label>
          <el-input id="bind-username" ref="bindEmailInput" v-model="bindForm.email" :class="{ 'auth-email-input': !hideLoginDomain }" type="text"
                    :placeholder="emailPlaceholder" autocomplete="username" :inputmode="hideLoginDomain ? 'email' : 'text'"
                    autocapitalize="none" :spellcheck="false" :enterkeyhint="hasInviteField ? 'next' : 'go'" required :disabled="busy"
                    @keydown.enter="onFieldEnter($event, 'bind', 'email')">
            <template v-if="!hideLoginDomain" #append>
              <el-select v-model="suffix" class="auth-domain-select" :aria-label="t('authDomainLabel')"
                         :placeholder="t('select')" :disabled="busy" @keydown.enter.stop>
                <el-option v-for="item in domainList" :key="item" :label="item" :value="item" />
              </el-select>
            </template>
          </el-input>
        </div>
        <div v-if="hasInviteField" class="auth-field">
          <label for="bind-invite">{{ settingStore.settings.regKey === 0 ? t('regKey') : t('regKeyOptional') }}</label>
          <el-input id="bind-invite" ref="bindInviteInput" v-model="bindForm.code" type="text" :placeholder="t('authInvitePlaceholder')"
                    autocomplete="off" enterkeyhint="go" :required="settingStore.settings.regKey === 0" :disabled="busy"
                    @keydown.enter="onFieldEnter($event, 'bind', 'code')" />
        </div>
        <el-button class="auth-submit" type="primary" native-type="submit" :loading="bindLoading" :disabled="busy && !bindLoading">{{ t('authBindButton') }}</el-button>
      </form>
    </el-dialog>
  </div>
</template>

<script setup>
import router from '@/router';
import {useRoute} from 'vue-router';
import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, unref} from 'vue';
import {login, register} from '@/request/login.js';
import {websiteConfig} from '@/request/setting.js';
import {isEmail} from '@/utils/verify-utils.js';
import {useSettingStore} from '@/store/setting.js';
import {useAccountStore} from '@/store/account.js';
import {useUserStore} from '@/store/user.js';
import {useUiStore} from '@/store/ui.js';
import {Icon} from '@iconify/vue';
import BrandMark from '@/components/brand-mark/index.vue';
import {cvtR2Url} from '@/utils/convert.js';
import {loginUserInfo} from '@/request/my.js';
import {permsToRouter} from '@/perm/perm.js';
import {useI18n} from 'vue-i18n';
import {oauthBindUser, oauthLinuxDoLogin, oauthGithubLogin, oauthGoogleLogin} from '@/request/ouath.js';

const {t} = useI18n();
const accountStore = useAccountStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const settingStore = useSettingStore();
const route = useRoute();
const loginLoading = ref(false);
const registerLoading = ref(false);
const bindLoading = ref(false);
const oauthLoading = ref(false);
const busy = computed(() => loginLoading.value || registerLoading.value || bindLoading.value || oauthLoading.value);
const showBindForm = ref(false);
const show = ref('login');
const form = reactive({email: '', password: ''});
const registerForm = reactive({email: '', password: '', confirmPassword: '', code: ''});
const bindForm = reactive({email: '', oauthUserId: '', code: ''});
const domainList = computed(() => settingStore.domainList || []);
const suffix = ref(domainList.value[0] || '');
const hideLoginDomain = computed(() => settingStore.settings.loginDomain === 1);
const hasInviteField = computed(() => [0, 2].includes(settingStore.settings.regKey));
const emailLabel = computed(() => t(hideLoginDomain.value ? 'authEmailLabel' : 'authUsernameLabel'));
const emailPlaceholder = computed(() => t(hideLoginDomain.value ? 'authEmailPlaceholder' : 'authUsernamePlaceholder'));
const loginOpacity = computed(() => {
  const value = Number(settingStore.settings.loginOpacity ?? 1);
  const opacity = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  return uiStore.dark ? `rgba(27, 43, 44, ${opacity})` : `rgba(255, 255, 255, ${opacity})`;
});
const background = computed(() => settingStore.settings.background ? {
  backgroundImage: `url(${cvtR2Url(settingStore.settings.background)})`,
  backgroundRepeat: 'no-repeat', backgroundSize: 'cover', backgroundPosition: 'center',
} : null);
const projectUrl = computed(() => {
  const link = settingStore.settings.projectLink;
  if (!link) return '';
  if (link === true || link === 1) return 'https://github.com/masoneai/cloud-mail-optimized';
  try {
    const url = new URL(String(link));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
});

const loginEmailInput = ref();
const loginPasswordInput = ref();
const registerEmailInput = ref();
const registerPasswordInput = ref();
const registerConfirmInput = ref();
const registerInviteInput = ref();
const bindEmailInput = ref();
const bindInviteInput = ref();
const inputFlows = {
  login: {email: loginEmailInput, password: loginPasswordInput},
  register: {email: registerEmailInput, password: registerPasswordInput, confirmPassword: registerConfirmInput, code: registerInviteInput},
  bind: {email: bindEmailInput, code: bindInviteInput},
};
let composing = false;
let compositionEndedAt = 0;
function onCompositionStart() { composing = true; }
function onCompositionEnd() { composing = false; compositionEndedAt = Date.now(); }
function isCompositionActive(event, input) {
  return composing || event?.isComposing || event?.keyCode === 229 || unref(input?.isComposing) || Date.now() - compositionEndedAt < 60;
}
function onFieldEnter(event, flow, field) {
  const input = inputFlows[flow][field].value;
  // The appended domain selector handles its own Enter key.
  if (event.target !== input?.input) return;
  if (isCompositionActive(event, input)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat || busy.value) return;
  const sequence = flow === 'login' ? ['email', 'password']
    : flow === 'register' ? ['email', 'password', 'confirmPassword', ...(hasInviteField.value ? ['code'] : [])]
      : ['email', ...(hasInviteField.value ? ['code'] : [])];
  const nextField = sequence[sequence.indexOf(field) + 1];
  if (nextField) inputFlows[flow][nextField].value?.focus();
  else if (flow === 'login') submit();
  else if (flow === 'register') submitRegister();
  else bind();
}
async function switchForm() {
  if (busy.value || settingStore.settings.register !== 0) return;
  show.value = show.value === 'login' ? 'register' : 'login';
  composing = false;
  await nextTick();
  if (show.value === 'register' && verifyShow.value) resizeVerification();
  (show.value === 'login' ? loginEmailInput : registerEmailInput).value?.focus();
}

const oauthKeys = ['linuxdo', 'github', 'google'];
const oauthProvider = computed(() => {
  const fromState = route.query.state;
  if (oauthKeys.includes(fromState)) return fromState;
  const fromStore = sessionStorage.getItem('oauthProvider');
  return oauthKeys.includes(fromStore) ? fromStore : null;
});
const oauthProviders = computed(() => [
  {key: 'google', label: 'Google', icon: 'devicon:google', iconType: 'iconify'},
  {key: 'github', label: 'GitHub', icon: 'codicon:github-inverted', iconType: 'iconify'},
  {key: 'linuxdo', label: 'LinuxDo', icon: '/image/linuxdo.webp', iconType: 'image'},
].filter(p => settingStore.settings[p.key + 'Switch'] === 0));
function oauthLogin(provider) {
  if (busy.value || !oauthProviders.value.some(p => p.key === provider)) return;
  const clientId = settingStore.settings[provider + 'ClientId'];
  const redirectUri = encodeURIComponent(window.location.origin + '/login');
  const authorizeUrls = {
    linuxdo: `https://connect.linux.do/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email&state=${provider}`,
    github: `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=${provider}`,
    google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email&state=${provider}`,
  };
  oauthLoading.value = true;
  sessionStorage.setItem('oauthProvider', provider);
  window.location.href = authorizeUrls[provider];
}
const loginFns = {linuxdo: oauthLinuxDoLogin, github: oauthGithubLogin, google: oauthGoogleLogin};
async function oauthGetUser() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code || !oauthProvider.value) return;
  const provider = oauthProvider.value;
  oauthLoading.value = true;
  sessionStorage.removeItem('oauthProvider');
  window.history.replaceState({}, '', window.location.origin + window.location.pathname);
  try {
    const data = await loginFns[provider](code, window.location.origin + '/login');
    bindForm.oauthUserId = data.userInfo.oauthUserId;
    if (!data.token) {
      showBindForm.value = true;
      ElMessage({message: t('authBindNotice'), type: 'warning', duration: 4000, plain: true});
      return;
    }
    await saveToken(data.token);
  } catch {
    // The shared request layer displays server errors.
  } finally {
    oauthLoading.value = false;
  }
}

const getFullEmail = email => hideLoginDomain.value ? email : email + suffix.value;
const getEmailName = email => email.split('@')[0];
function errorMessage(key, params) {
  ElMessage({message: t(key, params || {}), type: 'error', plain: true});
}
function validateEmail(email, checkPrefix = false) {
  if (!email) { errorMessage('emptyEmailMsg'); return false; }
  if (checkPrefix && getEmailName(email).length < settingStore.settings.minEmailPrefix) {
    errorMessage('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}); return false;
  }
  if (!isEmail(getFullEmail(email))) { errorMessage('notEmailMsg'); return false; }
  return true;
}
function validateInvite(code) {
  if (settingStore.settings.regKey === 0 && !code) { errorMessage('emptyRegKeyMsg'); return false; }
  return true;
}
async function submit(event) {
  if (busy.value || isCompositionActive(event) || show.value !== 'login' || showBindForm.value) return;
  if (!validateEmail(form.email)) return;
  if (!form.password) { errorMessage('emptyPwdMsg'); return; }
  loginLoading.value = true;
  try {
    const data = await login(getFullEmail(form.email), form.password);
    await saveToken(data.token);
  } catch {
    // The shared request layer displays server errors.
  } finally {
    loginLoading.value = false;
  }
}
async function bind(event) {
  if (busy.value || isCompositionActive(event) || !showBindForm.value) return;
  if (!validateEmail(bindForm.email, true) || !validateInvite(bindForm.code)) return;
  bindLoading.value = true;
  try {
    const data = await oauthBindUser({email: getFullEmail(bindForm.email), oauthUserId: bindForm.oauthUserId, code: bindForm.code});
    await saveToken(data.token);
  } catch {
    // The shared request layer displays server errors.
  } finally {
    bindLoading.value = false;
  }
}
async function saveToken(token) {
  localStorage.setItem('token', token);
  refreshWebsiteConfig();
  const user = await loginUserInfo();
  accountStore.currentAccountId = user.account.accountId;
  accountStore.currentAccount = user.account;
  userStore.user = user;
  permsToRouter(user.permKeys).forEach(routerData => router.addRoute('layout', routerData));
  await router.replace({name: 'layout'});
  uiStore.showNotice();
}
function refreshWebsiteConfig() {
  websiteConfig().then(setting => {
    settingStore.settings = setting;
    settingStore.domainList = setting.domainList;
    if (!suffix.value && setting.domainList.length) suffix.value = setting.domainList[0];
    document.title = setting.title;
  }).catch(() => {});
}

const verifyShow = ref(false);
const botJsError = ref(false);
const turnstileContainer = ref();
let verifyToken = '';
let turnstileId = null;
let verifyErrorCount = 0;
let verifyTimer;
let verificationActive = true;
let turnstileSize;
const verificationSize = () => turnstileContainer.value?.clientWidth < 300 ? 'compact' : 'normal';
async function renderVerification(reset = false, deadline = Date.now() + 10000) {
  await nextTick();
  if (!verificationActive || !verifyShow.value || !turnstileContainer.value) return;
  clearTimeout(verifyTimer);
  if (!window.turnstile?.render) {
    if (Date.now() < deadline) verifyTimer = setTimeout(() => renderVerification(reset, deadline), 250);
    else botJsError.value = true;
    return;
  }
  try {
    botJsError.value = false;
    if (turnstileId !== null) {
      if (reset) window.turnstile.reset(turnstileId);
      return;
    }
    turnstileSize = verificationSize();
    turnstileId = window.turnstile.render(turnstileContainer.value, {
      sitekey: settingStore.settings.siteKey,
      theme: uiStore.dark ? 'dark' : 'light',
      size: turnstileSize,
      callback: token => { if (verificationActive) { verifyToken = token; verifyErrorCount = 0; } },
      'expired-callback': () => { verifyToken = ''; },
      'error-callback': () => {
        verifyToken = '';
        if (!verificationActive) return;
        if (verifyErrorCount++ >= 4) { botJsError.value = true; return; }
        verifyTimer = setTimeout(() => renderVerification(true), 1500);
      },
    });
  } catch {
    botJsError.value = true;
  }
}
function resizeVerification() {
  if (!verifyShow.value || show.value !== 'register' || turnstileId === null || verificationSize() === turnstileSize) return;
  verifyToken = '';
  try { window.turnstile?.remove(turnstileId); } catch { /* Widget may already be removed. */ }
  turnstileId = null;
  renderVerification();
}
async function submitRegister(event) {
  if (busy.value || isCompositionActive(event) || show.value !== 'register' || settingStore.settings.register !== 0) return;
  if (!validateEmail(registerForm.email, true)) return;
  if (!registerForm.password) { errorMessage('emptyPwdMsg'); return; }
  if (registerForm.password.length < 6) { errorMessage('pwdLengthMsg'); return; }
  if (registerForm.password !== registerForm.confirmPassword) { errorMessage('confirmPwdFailMsg'); return; }
  if (!validateInvite(registerForm.code)) return;
  const requiresVerification = settingStore.settings.registerVerify === 0
    || (settingStore.settings.registerVerify === 2 && settingStore.settings.regVerifyOpen);
  if (!verifyToken && requiresVerification) {
    if (!verifyShow.value || botJsError.value) {
      verifyShow.value = true;
      renderVerification(botJsError.value);
    } else {
      errorMessage('botVerifyMsg');
    }
    return;
  }
  registerLoading.value = true;
  try {
    const {regVerifyOpen} = await register({email: getFullEmail(registerForm.email), password: registerForm.password, token: verifyToken, code: registerForm.code});
    show.value = 'login';
    Object.assign(registerForm, {email: '', password: '', confirmPassword: '', code: ''});
    verifyToken = '';
    settingStore.settings.regVerifyOpen = regVerifyOpen;
    verifyShow.value = false;
    if (turnstileId !== null) window.turnstile?.reset(turnstileId);
    ElMessage({message: t('regSuccessMsg'), type: 'success', plain: true});
    registerLoading.value = false;
    await nextTick();
    loginEmailInput.value?.focus();
  } catch (error) {
    if (error?.code === 400) {
      verifyToken = '';
      settingStore.settings.regVerifyOpen = true;
      verifyShow.value = true;
      renderVerification(true);
    }
  } finally {
    registerLoading.value = false;
  }
}
onBeforeUnmount(() => {
  verificationActive = false;
  clearTimeout(verifyTimer);
  window.removeEventListener('resize', resizeVerification);
  if (turnstileId !== null) {
    try { window.turnstile?.remove(turnstileId); } catch { /* Widget may already be removed. */ }
  }
});
onMounted(() => window.addEventListener('resize', resizeVerification, {passive: true}));
oauthGetUser();
</script>

<style lang="scss" scoped>
.login-page {
  --auth-story-color: #254f48;
  --auth-soft-color: #63857b;
  --auth-shadow: 0 20px 70px rgba(37, 77, 67, 0.08), 0 3px 12px rgba(37, 77, 67, 0.03);
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100%;
  height: 100dvh;
  overflow: auto;
  color: var(--mail-text);
  background: radial-gradient(ellipse at 15% 25%, #fbf8ef 0, transparent 55%), linear-gradient(135deg, #f9f7ef, #edf4ef);
}
.login-background { position: fixed; inset: 0; z-index: -1; }
.auth-shell {
  width: min(1160px, 100%);
  min-height: 100%;
  margin: 0 auto;
  padding: 48px 40px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.95fr);
  align-items: center;
  gap: clamp(40px, 6vw, 84px);
}
.auth-story { min-width: 0; color: var(--auth-story-color); }
.auth-brand { display: flex; align-items: center; gap: 13px; font-size: 20px; font-weight: 650; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.auth-brand-icon { width: 46px; height: 46px; flex: 0 0 46px; display: block; border-radius: 14px; }
.auth-story-copy { margin-top: 40px; max-width: 470px; }
.auth-story-copy h1 { font-size: clamp(33px, 3.1vw, 44px); line-height: 1.35; font-weight: 600; letter-spacing: -0.04em; text-wrap: balance; }
.auth-story-copy p { margin-top: 17px; font-size: 15px; line-height: 1.85; color: var(--auth-soft-color); }
.auth-illustration { width: 100%; max-width: 490px; aspect-ratio: 1; object-fit: cover; border-radius: 30px; margin: 22px 0 0; mix-blend-mode: multiply; }
.auth-story-note { display: flex; align-items: center; gap: 9px; margin-top: 4px; font-size: 12px; color: var(--auth-soft-color); letter-spacing: 0.025em; }
.auth-story-note span { width: 5px; height: 5px; border-radius: 50%; background: #96b4a3; }
.auth-card { width: 100%; border: 1px solid var(--mail-border); border-radius: 26px; padding: 38px; box-shadow: var(--auth-shadow); backdrop-filter: blur(16px); }
.auth-eyebrow { display: block; color: var(--mail-accent); font-size: 11px; font-weight: 600; letter-spacing: 0.16em; }
.auth-card-heading h2 { margin-top: 10px; font-size: 28px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.3; }
.auth-card-heading p { margin-top: 10px; font-size: 13px; line-height: 1.7; color: var(--mail-muted); }
.auth-form { display: grid; gap: 19px; margin-top: 28px; }
.auth-field { display: grid; gap: 9px; min-width: 0; }
.auth-field label { font-size: 13px; font-weight: 550; }
.auth-field-hint { color: var(--mail-muted); font-size: 11px; line-height: 1.5; }
.auth-field :deep(.el-input) { width: 100%; height: 47px; }
.auth-field :deep(.el-input__wrapper) { background-color: var(--mail-surface); border-radius: 11px; padding: 1px 13px; box-shadow: 0 0 0 1px var(--mail-border) inset; transition: box-shadow 160ms ease; }
.auth-field :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px var(--mail-muted) inset; }
.auth-field :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 2px var(--mail-accent) inset; }
.auth-field :deep(.el-input__inner) { font-size: 14px; min-width: 0; }
.auth-field :deep(.el-input__inner::placeholder) { color: var(--mail-muted); font-size: 13px; opacity: 0.8; }
.auth-email-input :deep(.el-input__wrapper) { border-radius: 11px 0 0 11px; }
.auth-email-input :deep(.el-input-group__append) { padding: 0; border-radius: 0 11px 11px 0; background: var(--mail-canvas); box-shadow: 0 0 0 1px var(--mail-border) inset; }
.auth-domain-select { width: 144px; max-width: 44vw; }
.auth-email-input :deep(.el-input-group__append .auth-domain-select) { margin: 0 !important; }
.auth-domain-select :deep(.el-select__wrapper) { min-height: 47px; border-radius: 0 11px 11px 0; background: transparent; box-shadow: none !important; padding: 8px 10px; }
.auth-domain-select :deep(.el-select__wrapper.is-focused) { box-shadow: 0 0 0 2px var(--mail-accent) inset !important; }
.auth-domain-select :deep(.el-select__selected-item) { font-size: 12px; }
.auth-submit { width: 100%; height: 47px; margin: 3px 0 0; border-radius: 11px; font-size: 14px; font-weight: 600; color: var(--mail-on-accent); }
.auth-submit :deep(span) { display: inline-flex; align-items: center; justify-content: center; gap: 12px; }
.auth-divider { display: flex; align-items: center; gap: 12px; margin: 24px 0 16px; color: var(--mail-muted); font-size: 11px; }
.auth-divider::before, .auth-divider::after { content: ''; height: 1px; flex: 1; background: var(--mail-border); }
.auth-oauth-buttons { display: grid; grid-template-columns: repeat(auto-fit, minmax(93px, 1fr)); gap: 9px; }
.auth-oauth-button { margin: 0 !important; min-width: 0; height: 42px; padding: 0 9px; border-radius: 10px; background: var(--mail-surface); border-color: var(--mail-border); color: var(--mail-text); font-size: 12px; }
.auth-oauth-button :deep(span) { display: flex; align-items: center; gap: 7px; }
.auth-switch { display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; gap: 6px; margin-top: 23px; font-size: 12px; color: var(--mail-muted); }
.auth-switch button { color: var(--mail-accent); font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px; border-radius: 4px; }
.auth-switch button:hover { text-decoration: underline; text-underline-offset: 4px; }
.auth-switch button:disabled { cursor: default; opacity: 0.5; }
.auth-footer { margin-top: 24px; padding-top: 19px; border-top: 1px solid var(--mail-border); text-align: center; }
.auth-footer a { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; color: var(--mail-muted); text-decoration: none; border-radius: 4px; }
.auth-footer a:hover { color: var(--mail-accent); }
.auth-verification { min-width: 0; }
.auth-verification-error { color: var(--el-color-danger); font-size: 12px; line-height: 1.6; }
.auth-bind-description { font-size: 13px; color: var(--mail-muted); line-height: 1.7; }
.login-page--custom .auth-story { border: 1px solid var(--mail-border); padding: 28px; border-radius: 26px; background: rgba(250, 249, 241, 0.88); backdrop-filter: blur(12px); }
.login-page--dark { --auth-story-color: #dcebe3; --auth-soft-color: #a4beb3; --auth-shadow: 0 20px 70px rgba(0, 0, 0, 0.18); background: radial-gradient(ellipse at 15% 25%, #1f3933 0, transparent 55%), linear-gradient(135deg, #182b27, #142325); }
.login-page--dark .auth-illustration { mix-blend-mode: normal; filter: brightness(0.8) saturate(0.85); }
.login-page--dark.login-page--custom .auth-story { background: rgba(27, 43, 44, 0.88); }
@media (max-width: 1000px) {
  .auth-shell { padding: 32px 28px; gap: 34px; grid-template-columns: minmax(0, 1fr) minmax(340px, 1fr); }
  .auth-card { padding: 30px; }
  .auth-story-copy { margin-top: 30px; }
  .auth-story-copy h1 { font-size: 34px; }
}
@media (max-width: 780px) {
  .auth-shell { width: min(490px, 100%); padding: 28px 20px; grid-template-columns: minmax(0, 1fr); align-content: center; gap: 25px; }
  .auth-brand { font-size: 17px; }
  .auth-brand-icon { width: 40px; height: 40px; flex-basis: 40px; border-radius: 12px; }
  .auth-story-copy, .auth-illustration, .auth-story-note { display: none; }
  .auth-card { padding: 30px 28px; border-radius: 22px; }
  .auth-card-heading h2 { font-size: 26px; }
  .auth-form { gap: 18px; margin-top: 26px; }
  .login-page--custom .auth-story { padding: 14px 18px; border-radius: 18px; }
}
@media (max-width: 380px) {
  .auth-shell { padding: 22px 14px; gap: 20px; }
  .auth-card { padding: 25px 22px; }
  .auth-domain-select { width: 125px; }
  .auth-oauth-buttons { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .auth-field :deep(.el-input__wrapper) { transition: none; }
}
</style>

<style>
.auth-bind-dialog { max-width: calc(100vw - 32px); border-radius: 20px; padding: 25px; }
.auth-bind-dialog .el-dialog__header { padding-right: 24px; }
.auth-bind-dialog .el-dialog__title { font-size: 21px; font-weight: 600; color: var(--mail-text); }
</style>
