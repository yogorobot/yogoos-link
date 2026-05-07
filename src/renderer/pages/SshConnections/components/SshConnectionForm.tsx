import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import type { ConnectionFormValues } from '../types';
import type { ConnectionFormErrors } from '../validation';

interface SshConnectionFormProps {
  values: ConnectionFormValues;
  isEditing: boolean;
  isConnecting: boolean;
  hostOptions: string[];
  errors: ConnectionFormErrors;
  onChange: (values: ConnectionFormValues) => void;
  onSave: () => void;
  onConnect: () => void;
  onCancel: () => void;
  onSelectKeyFile: () => void;
}

export default function SshConnectionForm({
  values,
  isEditing,
  isConnecting,
  hostOptions,
  errors,
  onChange,
  onSave,
  onConnect,
  onCancel,
  onSelectKeyFile,
}: SshConnectionFormProps) {
  const [isHostFocused, setIsHostFocused] = useState(false);
  const filteredHostOptions = useMemo(() => {
    const keyword = values.host.trim().toLowerCase();
    return hostOptions.filter((host) => host.toLowerCase().includes(keyword));
  }, [hostOptions, values.host]);
  const shouldShowHostOptions = isHostFocused && filteredHostOptions.length > 0;

  const inputClassName = (field: keyof ConnectionFormValues) =>
    `yogo-input rounded-xl px-3 py-2.5 transition ${
      errors[field]
        ? 'border-red-400/70 focus:border-red-400 focus:ring-red-500/30'
        : ''
    }`;

  const renderError = (field: keyof ConnectionFormValues) =>
    errors[field] ? (
      <span className="min-h-4 text-xs font-medium leading-4 text-red-300">
        {errors[field]}
      </span>
    ) : (
      <span className="min-h-4" aria-hidden="true" />
    );

  const updateField = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = event.target;
    const nextValue =
      type === 'checkbox' ? (event.target as HTMLInputElement).checked : value;
    onChange({ ...values, [name]: nextValue });
  };

  const selectHost = (host: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onChange({ ...values, host });
    setIsHostFocused(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onConnect();
  };

  return (
    <form className="p-6 max-sm:p-4" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-6 border-b border-slate-700/70 pb-5 max-sm:flex-col">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            {isEditing ? '编辑连接' : '新增连接'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            密码仅用于本次连接，不会写入本地存储。
          </p>
        </div>
        <button
          type="button"
          className="yogo-button-secondary rounded-lg px-3 py-2 text-sm font-medium transition max-sm:w-full"
          onClick={onCancel}
        >
          取消
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div className="relative grid gap-1.5 text-sm font-medium text-slate-300">
          <label htmlFor="ssh-host-input">主机</label>
          <input
            id="ssh-host-input"
            className={inputClassName('host')}
            name="host"
            value={values.host}
            onChange={updateField}
            onFocus={() => setIsHostFocused(true)}
            onBlur={() => setIsHostFocused(false)}
            placeholder="192.168.1.10"
            autoComplete="off"
          />
          {renderError('host')}
          {shouldShowHostOptions && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-1 shadow-xl shadow-slate-950/70">
              {filteredHostOptions.map((host) => (
                <button
                  key={host}
                  type="button"
                  className="block w-full break-all rounded-xl px-3 py-2 text-left text-sm font-medium leading-5 text-slate-200 transition hover:bg-blue-500/15 hover:text-blue-200"
                  onMouseDown={(event) => selectHost(host, event)}
                >
                  {host}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-slate-300">
          <span>端口</span>
          <input
            className={inputClassName('port')}
            name="port"
            value={values.port}
            onChange={updateField}
            placeholder="22"
          />
          {renderError('port')}
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-300">
          <span>用户名</span>
          <input
            className={inputClassName('username')}
            name="username"
            value={values.username}
            onChange={updateField}
            placeholder="yogo"
          />
          {renderError('username')}
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-300">
          <span>密码</span>
          <input
            className={inputClassName('password')}
            name="password"
            type="password"
            value={values.password}
            onChange={updateField}
            placeholder="连接密码"
          />
          {renderError('password')}
        </label>
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-300">
        <input
          className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-blue-600"
          name="useJumpHost"
          type="checkbox"
          checked={values.useJumpHost}
          onChange={updateField}
        />
        <span>通过跳板机连接</span>
      </label>

      {values.useJumpHost && (
        <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/35 p-4">
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <label className="grid gap-1.5 text-sm font-medium text-slate-300">
              <span>跳板机地址</span>
              <input
                className={inputClassName('jumpHost')}
                name="jumpHost"
                value={values.jumpHost}
                onChange={updateField}
              />
              {renderError('jumpHost')}
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-300">
              <span>跳板机端口</span>
              <input
                className={inputClassName('jumpPort')}
                name="jumpPort"
                value={values.jumpPort}
                onChange={updateField}
              />
              {renderError('jumpPort')}
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-300">
              <span>跳板机用户名</span>
              <input
                className={inputClassName('jumpUsername')}
                name="jumpUsername"
                value={values.jumpUsername}
                onChange={updateField}
              />
              {renderError('jumpUsername')}
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-300">
              <span>认证方式</span>
              <select
                className="yogo-input rounded-xl px-3 py-2.5 transition"
                name="jumpAuthType"
                value={values.jumpAuthType}
                onChange={updateField}
              >
                <option value="key">私钥</option>
                <option value="password">密码</option>
              </select>
            </label>
          </div>

          {values.jumpAuthType === 'password' ? (
            <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-300">
              <span>跳板机密码</span>
              <input
                className="yogo-input rounded-xl px-3 py-2.5 transition"
                name="jumpPassword"
                type="password"
                value={values.jumpPassword}
                onChange={updateField}
              />
              {renderError('jumpPassword')}
            </label>
          ) : (
            <div className="mt-4 flex items-end gap-3 max-sm:flex-col max-sm:items-stretch">
              <label className="grid flex-1 gap-1.5 text-sm font-medium text-slate-300">
                <span>跳板机私钥路径</span>
                <input
                  className="yogo-input rounded-xl px-3 py-2.5 transition"
                  name="jumpKeyFilePath"
                  value={values.jumpKeyFilePath}
                  onChange={updateField}
                />
                {renderError('jumpKeyFilePath')}
              </label>
              <button
                type="button"
                className="yogo-button-secondary rounded-xl px-4 py-2.5 text-sm font-medium transition"
                onClick={onSelectKeyFile}
              >
                选择文件
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-700/70 pt-5 max-sm:flex-col">
        <button
          type="button"
          className="yogo-button-secondary rounded-xl px-4 py-2.5 text-sm font-medium transition max-sm:w-full"
          onClick={onSave}
        >
          保存配置
        </button>
        <button
          type="submit"
          className="yogo-button-primary rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 max-sm:w-full"
          disabled={isConnecting}
        >
          {isConnecting ? '连接中...' : '连接'}
        </button>
      </div>
    </form>
  );
}
