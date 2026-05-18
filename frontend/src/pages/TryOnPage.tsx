import { useState } from 'react';
import { Card, Upload, Button, Select, Space, Image, message, Spin } from 'antd';
import { UploadOutlined, ExperimentOutlined } from '@ant-design/icons';

const MOCK_STYLES = [
  { id: 1, name: '法式简约', color: '#ffe4e1' },
  { id: 2, name: '星空渐变', color: '#6a5acd' },
  { id: 3, name: '樱花粉', color: '#ffb7c5' },
  { id: 4, name: '经典红色', color: '#dc143c' },
  { id: 5, name: '裸色优雅', color: '#deb887' },
  { id: 6, name: '闪钻奢华', color: '#ffd700' },
];

export default function TryOnPage() {
  const [handImage, setHandImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTryOn = async () => {
    if (!handImage || !selectedStyle) {
      message.warning('请先上传手部照片并选择款式');
      return;
    }
    setLoading(true);
    // Mock: 1.5秒模拟处理
    await new Promise(r => setTimeout(r, 1500));
    setResultImage(handImage); // Mock: 返回原图作为结果占位
    setLoading(false);
    message.success('试戴完成！');
  };

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* 左侧：上传手图 */}
      <Card title="上传手部照片" style={{ flex: 1, minWidth: 300 }}>
        <Upload.Dragger
          accept="image/*"
          showUploadList={false}
          beforeUpload={(file) => {
            const reader = new FileReader();
            reader.onload = (e) => setHandImage(e.target?.result as string);
            reader.readAsDataURL(file);
            return false;
          }}
        >
          {handImage ? (
            <Image src={handImage} alt="手部照片" style={{ maxHeight: 200 }} />
          ) : (
            <>
              <UploadOutlined style={{ fontSize: 48, color: '#ff69b4' }} />
              <p>点击或拖拽上传手部照片</p>
            </>
          )}
        </Upload.Dragger>
      </Card>

      {/* 中间：选择款式 */}
      <Card title="选择美甲款式" style={{ flex: 1, minWidth: 300 }}>
        <Select
          placeholder="选择一款美甲"
          style={{ width: '100%' }}
          value={selectedStyle}
          onChange={setSelectedStyle}
          options={MOCK_STYLES.map(s => ({ label: s.name, value: s.id }))}
        />
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MOCK_STYLES.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedStyle(s.id)}
              style={{
                width: 60, height: 60, borderRadius: 8, cursor: 'pointer',
                background: `linear-gradient(135deg, ${s.color}, ${s.color}88)`,
                border: selectedStyle === s.id ? '3px solid #ff69b4' : '3px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#fff', fontWeight: 500,
              }}
            >
              {s.name.slice(0, 2)}
            </div>
          ))}
        </div>
        <Button
          type="primary"
          icon={<ExperimentOutlined />}
          onClick={handleTryOn}
          loading={loading}
          block
          style={{ marginTop: 16, background: '#ff69b4' }}
          size="large"
        >
          开始试戴
        </Button>
      </Card>

      {/* 右侧：试戴结果 */}
      <Card title="试戴效果" style={{ flex: 1, minWidth: 300 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#999' }}>AI正在为你生成试戴效果...</p>
          </div>
        ) : resultImage ? (
          <Image src={resultImage} alt="试戴效果" style={{ borderRadius: 8 }} />
        ) : (
          <div style={{
            height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ccc', fontSize: 16, background: '#fafafa', borderRadius: 8
          }}>
            选择款式并点击试戴查看效果
          </div>
        )}
      </Card>
    </div>
  );
}
