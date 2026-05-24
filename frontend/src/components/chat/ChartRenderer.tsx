import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ChartRendererProps {
  config: string | object;
  id: string;
}

export default function ChartRenderer({ config, id }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = typeof config === 'string' ? JSON.parse(config) : (config as Record<string, unknown>);
    } catch {
      return;
    }

    // Destroy previous instance
    chartInstance.current?.dispose();
    const instance = echarts.init(chartRef.current, undefined, { height: 280 });
    chartInstance.current = instance;

    // Build ECharts option from the config
    const option: Record<string, unknown> = {
      title: {
        text: parsed.title as string,
        textStyle: { fontSize: 13, color: '#666' },
        left: 'center',
      },
      tooltip: { trigger: 'axis' as const },
      legend: {
        data: ((parsed.series as Array<{ name: string }>) || []).map((s) => s.name),
        bottom: 0,
        textStyle: { fontSize: 11 },
      },
      grid: { top: 40, right: 20, bottom: 40, left: 50 },
      xAxis: {
        type: 'category',
        data: parsed.xAxis as string[],
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10 },
      },
      series: ((parsed.series as Array<Record<string, unknown>>) || []).map((s) => ({
        ...s,
        type: (parsed.type as string) || 'line',
        smooth: true,
      })),
    };

    instance.setOption(option);

    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      instance.dispose();
    };
  }, [config]);

  return (
    <div
      id={id}
      className="chart-renderer"
      ref={chartRef}
      style={{ width: '100%', height: 280, margin: '8px 0' }}
    />
  );
}
