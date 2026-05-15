<!--
  定义一个 Vue 3 的单文件组件
  lang="ts" 表示使用 TypeScript 语法
  setup 表示使用组合式 API 的语法糖
-->
<script lang="ts" setup>
// 从 Vben 框架的公共 UI 库中，引入登录相关的参数类型和表单配置类型
import type { LoginCodeParams, VbenFormSchema } from '@vben/common-ui';

// 引入后端接口返回的租户信息的数据类型
import type { TenantResp } from '#/api';

// 引入 Vue 3 的核心 API：计算属性、挂载生命周期、响应式变量、模板引用
import { computed, onMounted, ref, useTemplateRef } from 'vue';

// 引入 Vben 封装好的验证码登录组件、以及 zod 表单校验库
import { AuthenticationCodeLogin, z } from '@vben/common-ui';
// 引入默认的租户 ID 常量
import { DEFAULT_TENANT_ID } from '@vben/constants';
// 引入国际化翻译函数 $t，用于多语言处理
import { $t } from '@vben/locales';

// 引入 Ant Design Vue 的 Alert 警告提示组件
import { Alert } from 'antdv-next';

// 引入获取租户列表的后端接口方法
import { tenantList } from '#/api';
// 引入发送短信验证码的后端接口方法
import { sendSmsCode } from '#/api/core/captcha';
// 引入用于处理登录鉴权的 Pinia 状态管理仓库
import { useAuthStore } from '#/store';

// 定义当前组件的名称为 'CodeLogin'，方便在 Vue Devtools 中调试
defineOptions({ name: 'CodeLogin' });

// 定义一个响应式的加载状态变量，初始值为 false（未加载中）
const loading = ref(false);
// 定义验证码的长度常量，这里设置为 4 位
const CODE_LENGTH = 4;

// 定义一个响应式的租户信息对象，并设置初始默认值（租户功能关闭，列表为空）
const tenantInfo = ref<TenantResp>({
  tenantEnabled: false,
  voList: [],
});

// 获取模板中 ref="codeLoginRef" 对应的组件实例，用于后续调用组件内部的方法
const codeLoginRef = useTemplateRef('codeLoginRef');

// 定义一个异步函数，用于加载租户列表数据
async function loadTenant() {
  const resp = await tenantList(); // 调用后端接口获取租户列表
  tenantInfo.value = resp; // 将获取到的数据赋值给响应式变量 tenantInfo

  // 如果开启了多租户功能，且租户列表中有数据
  if (resp.tenantEnabled && resp.voList.length > 0) {
    // 获取列表中的第一个租户 ID
    const firstTenantId = resp.voList[0]!.tenantId;
    // 通过表单 API，将第一个租户 ID 自动填入表单的 'tenantId' 字段中
    codeLoginRef.value?.getFormApi().setFieldValue('tenantId', firstTenantId);
  }
}

// 页面组件挂载完成后，立即执行加载租户列表的函数
onMounted(loadTenant);

// 定义一个计算属性 formSchema，用于动态生成表单的配置项
const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenSelect', // 第一个表单项：使用下拉选择框组件
      componentProps: { // 传递给下拉框组件的属性
        class: 'bg-background h-[40px] focus:border-primary', // 自定义 CSS 样式类
        contentClass: 'max-h-[256px] overflow-y-auto', // 下拉内容的样式（最大高度和滚动）
        // 将租户列表映射成下拉框需要的 options 格式（label 显示公司名，value 存租户ID）
        options: tenantInfo.value.voList?.map((item) => ({
          label: item.companyName,
          value: item.tenantId,
        })),
        placeholder: $t('authentication.selectAccount'), // 输入框的占位提示文字（国际化）
      },
      defaultValue: DEFAULT_TENANT_ID, // 该字段的默认值
      dependencies: { // 依赖配置：控制该字段是否显示
        if: () => tenantInfo.value.tenantEnabled, // 只有当开启多租户时才显示此字段
        triggerFields: [''], // 触发依赖检查的字段（这里为空表示跟随全局或初始化触发）
      },
      fieldName: 'tenantId', // 表单字段的唯一标识名
      label: $t('authentication.selectAccount'), // 表单左侧显示的标签文字
      rules: z.string().min(1, { message: $t('authentication.selectAccount') }), // 使用 zod 定义校验规则：必须是字符串且至少1位（即必选）
    },
    {
      component: 'VbenInput', // 第二个表单项：使用普通输入框组件
      componentProps: {
        placeholder: $t('authentication.mobile'), // 占位提示：请输入手机号
      },
      fieldName: 'phoneNumber', // 字段名：手机号
      label: $t('authentication.mobile'), // 标签文字：手机号
      // 使用 zod 定义校验规则
      rules: z
        .string()
        .min(1, { message: $t('authentication.mobileTip') }) // 规则1：必填，否则提示“请输入手机号”
        .refine((v) => /^\d{11}$/.test(v), { // 规则2：自定义校验，使用正则表达式匹配
          message: $t('authentication.mobileErrortip'), // 如果不是11位纯数字，提示“手机号格式错误”
        }),
    },
    {
      component: 'VbenPinInput', // 第三个表单项：使用验证码专用输入框组件
      // componentProps 接收一个函数，可以拿到表单的上下文（如 form 实例）
      componentProps(_, form) {
        return {
          // 自定义发送验证码按钮的文字逻辑
          createText: (countdown: number) => {
            // 如果倒计时大于0，显示“重新发送(秒数)”，否则显示“发送验证码”
            const text =
              countdown > 0
                ? $t('authentication.sendText', [countdown])
                : $t('authentication.sendCode');
            return text;
          },
          codeLength: CODE_LENGTH, // 设置验证码输入的长度为 4 位
          placeholder: $t('authentication.code'), // 占位提示：请输入验证码
          // 定义点击“发送验证码”按钮时的处理逻辑
          handleSendCode: async () => {
            // 先校验表单中的 'phoneNumber' 字段是否合法
            const { valid, value } = await form.validateField('phoneNumber');
            if (!valid) {
              // 如果校验不通过，必须抛出异常，阻止后续发送逻辑
              throw new Error('未填写手机号');
            }
            // 校验通过，调用后端接口发送短信验证码
            await sendSmsCode(value);
            // 弹出成功的提示消息
            window.message.success('验证码发送成功');
          },
        };
      },
      fieldName: 'code', // 字段名：验证码
      label: $t('authentication.code'), // 标签文字：验证码
      // 校验规则：必须是长度为 4 的字符串
      rules: z.string().length(CODE_LENGTH, {
        message: $t('authentication.codeTip', [CODE_LENGTH]),
      }),
    },
  ];
});

// 获取全局的登录鉴权状态管理仓库实例
const authStore = useAuthStore();

// 定义处理登录提交的异步函数，接收表单填写好的数据 values
async function handleLogin(values: LoginCodeParams) {
  try {
    // 组装后端登录接口所需要的请求参数
    const requestParams: any = {
      tenantId: values.tenantId, // 租户ID
      phonenumber: values.phoneNumber, // 手机号
      smsCode: values.code, // 短信验证码
      grantType: 'sms', // 固定参数，告诉后端这是“短信验证码”登录方式
    };
    console.log('login params', requestParams); // 在控制台打印登录参数，方便调试
    // 调用仓库中的 authLogin 方法，发起真正的登录请求
    await authStore.authLogin(requestParams);
  } catch (error) {
    // 如果登录过程中发生错误（如验证码错误、网络异常），在这里捕获并打印
    console.error(error);
  }
}
</script>

<!-- 模板部分：定义页面的 HTML 结构 -->
<template>
  <div>
    <!-- 顶部的警告提示框，show-icon 显示图标，type="info" 表示信息提示类型 -->
    <Alert
      class="mb-4"
      show-icon
      message="测试手机号: 15888888888 正确验证码: 1234 演示使用 不会真的发送"
      type="info"
    />
    <!--
      Vben 封装好的验证码登录组件
      ref="codeLoginRef"：绑定组件引用，方便在 script 中操作该组件
      :form-schema="formSchema"：传入上面定义好的表单配置
      :loading="loading"：传入按钮的加载状态
      @submit="handleLogin"：监听表单提交事件，触发 handleLogin 函数
    -->
    <AuthenticationCodeLogin
      ref="codeLoginRef"
      :form-schema="formSchema"
      :loading="loading"
      @submit="handleLogin"
    />
  </div>
</template>
