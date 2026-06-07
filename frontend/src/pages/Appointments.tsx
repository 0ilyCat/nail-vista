import { useEffect, useState } from 'react';
import { Table, Tag, Button, Spin, message, Typography } from 'antd';
import { appointmentsAPI } from '../services/api';

const { Title } = Typography;
const statusMap: any = { pending: '待确认', confirmed: '已确认', completed: '已完成', cancelled: '已取消' };
const statusColor: any = { pending: 'orange', confirmed: 'blue', completed: 'green', cancelled: 'default' };

export default function AppointmentsPage() {
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppts = async () => {
    setLoading(true);
    try {
      const res = await appointmentsAPI.list({ page_size: 100 });
      setAppts(res.data.items || []);
    } catch (e) { message.warning('请先登录'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAppts(); }, []);

  const updateStatus = async (id: number, status: string) => {
    try {
      await appointmentsAPI.update(id, status);
      message.success('更新成功');
      fetchAppts();
    } catch (e: any) { message.error('更新失败'); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <Title level={2} style={{ color: '#2f4541' }}>📋 我的预约</Title>
      <Table rowKey="id" dataSource={appts} pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '商家', dataIndex: 'merchant_name' },
          { title: '款式', dataIndex: 'style_name' },
          { title: '服务', dataIndex: 'service_item' },
          { title: '时间', dataIndex: 'appointment_time' },
          { title: '价格', dataIndex: 'price', render: (v: number) => `¥${v?.toFixed(2)}` },
          { title: '状态', dataIndex: 'status', render: (s: string) => <Tag color={statusColor[s]}>{statusMap[s]}</Tag> },
          {
            title: '操作', render: (_, r: any) => (
              r.status === 'pending' ? (
                <span>
                  <Button size="small" type="primary" onClick={() => updateStatus(r.id, 'confirmed')}>确认</Button>
                  <Button size="small" danger style={{ marginLeft: 8 }} onClick={() => updateStatus(r.id, 'cancelled')}>取消</Button>
                </span>
              ) : null
            ),
          },
        ]} />
    </div>
  );
}

