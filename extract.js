const fs = require('fs');

const extractAndCreateSettingsPanel = () => {
    // We will create the SettingsPanel component inside src/components/SettingsPanel.tsx
    const content = `
import React from 'react';
import { SettingsIcon } from 'lucide-react';
import { Settings } from '../types';
import { PROVIDERS } from '../config/providers';

interface SettingsPanelProps {
    settings: Settings;
    setSettings: (settings: Settings | ((prev: Settings) => Settings)) => void;
}

export function SettingsPanel({ settings, setSettings }: SettingsPanelProps) {
    const handleAddApiKey = () => {
        setSettings(prev => ({
            ...prev,
            apiKeys: [...(prev.apiKeys || []), '']
        }));
    };

    const handleUpdateApiKey = (index: number, value: string) => {
        setSettings(prev => {
            const newKeys = [...(prev.apiKeys || [])];
            newKeys[index] = value;
            // 同步更新兼容的 apiKey 字段 (使用当前选中的密钥)
            return {
                ...prev,
                apiKeys: newKeys,
                apiKey: index === prev.currentKeyIndex ? value : prev.apiKey
            };
        });
    };

    const handleRemoveApiKey = (index: number) => {
        setSettings(prev => {
            const newKeys = [...(prev.apiKeys || [])];
            newKeys.splice(index, 1);
            let newCurrentIndex = prev.currentKeyIndex;
            if (newCurrentIndex >= index && newCurrentIndex > 0) {
                newCurrentIndex--;
            }
            return {
                ...prev,
                apiKeys: newKeys,
                currentKeyIndex: newCurrentIndex,
                apiKey: newKeys[newCurrentIndex] || ''
            };
        });
    };

    const handleSelectApiKey = (index: number) => {
        setSettings(prev => ({
            ...prev,
            currentKeyIndex: index,
            apiKey: prev.apiKeys?.[index] || ''
        }));
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <SettingsIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-800">AI 妯″瀷閰嶇疆</h2>
                        <p className="text-sm text-zinc-500">閫夋嫨骞堕厤缃綘鍠滄鐨?AI 鎻愪緵鍟?/p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">AI 鎻愪緵鍟?/label>
                        <select
                            value={settings.provider}
                            onChange={(e) => {
                                const provider = e.target.value as any;
                                setSettings((prev) => ({
                                    ...prev,
                                    provider,
                                    baseUrl: PROVIDERS[provider as keyof typeof PROVIDERS].baseUrl,
                                    model: PROVIDERS[provider as keyof typeof PROVIDERS].model,
                                    apiKeys: prev.apiKeys || [],
                                    currentKeyIndex: prev.currentKeyIndex || 0
                                }));
                            }}
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                            {Object.entries(PROVIDERS).map(([key, provider]) => (
                                <option key={key} value={key}>{provider.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-zinc-700">API Keys (鍙厤缃涓疆璇?)</label>
                            <button
                                onClick={handleAddApiKey}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                            >
                                <span>+</span> 娣诲姞 Key
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(settings.apiKeys || []).length === 0 ? (
                                <p className="text-sm text-zinc-500 italic py-2">鏆傛棤閰嶇疆 API Key锛岃鐐瑰嚮鍙充笂瑙掓坊鍔?/p>
                            ) : (
                                settings.apiKeys.map((key, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="currentApiKey"
                                            checked={settings.currentKeyIndex === index}
                                            onChange={() => handleSelectApiKey(index)}
                                            className="w-4 h-4 text-indigo-600 border-zinc-300 focus:ring-indigo-500"
                                            title="璁句负榛樿"
                                        />
                                        <input
                                            type="password"
                                            value={key}
                                            onChange={(e) => handleUpdateApiKey(index, e.target.value)}
                                            placeholder={\`输入第 \${index + 1} 个 API Key\`}
                                            className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                        <button
                                            onClick={() => handleRemoveApiKey(index)}
                                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="删除此 Key"
                                        >
                                            <span className="text-lg leading-none">×</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">鎻愮ず锛氶厤缃涓?Key 鍙湪閬囧埌璇锋眰闄愬埗鏃鸿嚜鍔ㄨ疆璇㈠垏鎹紙閫傜敤浜庡厤璐归搴︾殑鎻愪緵鍟嗭級銆傞�変腑鐨勫崟閫夋涓洪粯璁や娇鐢ㄧ殑棣栭�?Key銆?/p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">API Base URL</label>
                        <input
                            type="text"
                            value={settings.baseUrl}
                            onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Model Name</label>
                        {settings.provider === 'custom' || settings.provider === 'kilo' ? (
                            <input
                                type="text"
                                value={settings.model}
                                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                placeholder="输入模型名称，如 deepseek-chat"
                                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        ) : (
                            <select
                                value={settings.model}
                                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                {settings.availableModels && settings.availableModels.length > 0 ? (
                                    settings.availableModels.map(model => (
                                        <option key={model.id} value={model.id}>{model.name}</option>
                                    ))
                                ) : (
                                    PROVIDERS[settings.provider as keyof typeof PROVIDERS]?.models?.map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))
                                )}
                            </select>
                        )}
                        <button
                            onClick={async () => {
                                // Model fetching logic passed as prop ideally, simplified here or ignored if complex
                                alert('请在 App.tsx 顶层管理此功能，目前通过参数控制或原逻辑');
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-700 mt-2"
                        >
                            刷新可用模型列表
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <SettingsIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-800">生成参数设置</h2>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">每章最低字数</label>
                        <input
                            type="number"
                            value={settings.minWordCount || 2000}
                            onChange={(e) => setSettings({ ...settings, minWordCount: parseInt(e.target.value) || 2000 })}
                            min={500}
                            step={500}
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-zinc-700">创作自由度 (Temperature)</label>
                            <span className="text-sm font-semibold text-indigo-600">{(settings.temperature ?? 0.9).toFixed(1)}</span>
                        </div>
                        <input
                            type="range"
                            value={settings.temperature ?? 0.9}
                            onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                            min={0} max={2} step={0.1}
                            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
`;
    fs.writeFileSync('src/components/SettingsPanel.tsx', content, 'utf8');
    console.log("SettingsPanel created.");
};

extractAndCreateSettingsPanel();
