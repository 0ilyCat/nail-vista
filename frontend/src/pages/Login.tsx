import { useState } from 'react';
import { Card, Form, Input, Button, Tabs, message, Radio } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any, isRegister: boolean) => {
    setLoading(true);
    try {
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
      message.success(isRegister ? '注册成功！欢迎加入 NailVista' : '登录成功');
      if (res.data.user.role === 'merchant') nav('/merchant/join');
      else nav('/');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败，请重试');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card style={{ width: 400 }}>
        <Tabs items={[
          {
            key: 'login', label: '用户登录',
            children: (
              <Form onFinish={v => onFinish(v, false)} size="large">
                <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input placeholder="用户名" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password placeholder="密码" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'register', label: '注册',
            children: (
              <Form onFinish={v => onFinish(v, true)} size="large">
                <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input placeholder="用户名" />
                </Form.Item>
                <Form.Item name="nickname">
                  <Input placeholder="昵称（选填）" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
                  <Input.Password placeholder="密码（至少6位）" />
                </Form.Item>
                <Form.Item name="confirm_password" rules={[{ required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}>
                  <Input.Password placeholder="确认密码" />
                </Form.Item>
                <Form.Item name="role" initialValue="user">
                  <Radio.Group>
                    <Radio.Button value="user">普通用户</Radio.Button>
                    <Radio.Button value="merchant">商家</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>注册</Button>
                </Form.Item>
              </Form>
            ),
          },
        ]} />
        <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
          测试账号: xiaomei / 123456 (用户) | merchant01 / 123456 (商家)
        </div>
      </Card>
    </div>
  );
}
