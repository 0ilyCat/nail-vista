import { useState } from 'react';
import { Card, Form, Input, Button, Tabs, message, Radio, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { LockOutlined, UserOutlined, HighlightOutlined } from '@ant-design/icons';
import { authAPI } from '../services/api';

const { Title, Text } = Typography;

export default function LoginPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any, isRegister: boolean) => {
    setLoading(true);
    try {
      values = {
        ...values,
        username: values.username?.trim(),
        nickname: values.nickname?.trim(),
      };
      let res;
      if (isRegister) {
        if (values.password !== values.confirm_password) {
          message.error('两次密码不一致');
          setLoading(false);
          return;
        }
        res = await authAPI.register(values);
      } else {
        res = await authAPI.login(values);
      }
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      message.success(isRegister ? '注册成功，欢迎加入 NailVista' : '登录成功');
      if (res.data.user.role === 'merchant') nav('/merchant/join');
      else nav('/');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nv-login-shell">
      <Card className="nv-login-card">
        <div style={{ marginBottom: 24 }}>
          <div className="nv-kicker">
            <HighlightOutlined />
            NailVista 账号
          </div>
          <Title level={2} style={{ margin: '14px 0 6px' }}>欢迎回来</Title>
          <Text className="nv-muted">登录后可以保存试戴记录、预约店家和收藏灵感。</Text>
        </div>

        <Tabs items={[
          {
            key: 'login',
            label: '用户登录',
            children: (
              <Form onFinish={v => onFinish(v, false)} size="large" layout="vertical">
                <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>
                    登录
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'register',
            label: '注册',
            children: (
              <Form onFinish={v => onFinish(v, true)} size="large" layout="vertical">
                <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
                </Form.Item>
                <Form.Item name="nickname">
                  <Input placeholder="昵称，可选" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="密码，至少 6 位" autoComplete="new-password" />
                </Form.Item>
                <Form.Item name="confirm_password" rules={[
                  { required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="确认密码" autoComplete="new-password" />
                </Form.Item>
                <Form.Item name="role" initialValue="user">
                  <Radio.Group optionType="button" buttonStyle="solid">
                    <Radio.Button value="user">普通用户</Radio.Button>
                    <Radio.Button value="merchant">商家</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>
                    注册
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]} />

        <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: 'rgba(47,111,104,0.08)', color: '#2f4541', fontSize: 13 }}>
          测试账号：xiaomei / 123456（用户） · merchant01 / 123456（商家）
        </div>
      </Card>
    </div>
  );
}

