import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import type { ConnectionFormValues } from '../types';
import type { ConnectionFormErrors } from '../validation';

interface SshConnectionFormProps {
  values: ConnectionFormValues;
  isEditing: boolean;
  isConnecting: boolean;
  hostOptions: string[];
  jumpHostOptions?: string[];
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
  jumpHostOptions = [],
  errors,
  onChange,
  onSave,
  onConnect,
  onCancel,
  onSelectKeyFile,
}: SshConnectionFormProps) {
  const [isHostFocused, setIsHostFocused] = useState(false);
  const [isJumpHostFocused, setIsJumpHostFocused] = useState(false);

  const filteredHostOptions = useMemo(() => {
    const keyword = values.host.trim().toLowerCase();
    return hostOptions.filter((host) => host.toLowerCase().includes(keyword));
  }, [hostOptions, values.host]);
  const shouldShowHostOptions = isHostFocused && filteredHostOptions.length > 0;

  const filteredJumpHostOptions = useMemo(() => {
    const keyword = values.jumpHost.trim().toLowerCase();
    return jumpHostOptions.filter((host) =>
      host.toLowerCase().includes(keyword),
    );
  }, [jumpHostOptions, values.jumpHost]);
  const shouldShowJumpHostOptions =
    isJumpHostFocused && filteredJumpHostOptions.length > 0;

  const inputClassName = (field: keyof ConnectionFormValues) =>
    `yogo-input w-full rounded-xl px-3 py-2.5 transition ${
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

  const selectJumpHost = (
    jumpHost: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    onChange({ ...values, jumpHost });
    setIsJumpHostFocused(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onConnect();
  };

  return (
    <form
      className="flex max-h-full flex-col overflow-hidden"
      onSubmit={handleSubmit}
    >
      {/* Header: Fixed Top */}
      <div className="shrink-0 flex items-start justify-between gap-6 border-b border-slate-700/70 p-6 pb-4 max-sm:p-4 max-sm:pb-3">
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

      {/* Body: Scrollable Middle */}
      <div className="flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable] max-sm:p-4">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <div className="grid gap-1.5 text-sm font-medium text-slate-300">
            <label htmlFor="ssh-host-input">主机</label>
            <div className="relative">
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
            {renderError('host')}
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
              <div className="grid gap-1.5 text-sm font-medium text-slate-300">
                <label htmlFor="ssh-jump-host-input">跳板机地址</label>
                <div className="relative">
                  <input
                    id="ssh-jump-host-input"
                    className={inputClassName('jumpHost')}
                    name="jumpHost"
                    value={values.jumpHost}
                    onChange={updateField}
                    onFocus={() => setIsJumpHostFocused(true)}
                    onBlur={() => setIsJumpHostFocused(false)}
                    placeholder="jump.example.com"
                    autoComplete="off"
                  />
                  {shouldShowJumpHostOptions && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-1 shadow-xl shadow-slate-950/70">
                      {filteredJumpHostOptions.map((host) => (
                        <button
                          key={host}
                          type="button"
                          className="block w-full break-all rounded-xl px-3 py-2 text-left text-sm font-medium leading-5 text-slate-200 transition hover:bg-blue-500/15 hover:text-blue-200"
                          onMouseDown={(event) => selectJumpHost(host, event)}
                        >
                          {host}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {renderError('jumpHost')}
              </div>
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
                  className="yogo-input w-full rounded-xl px-3 py-2.5 transition"
                  name="jumpAuthType"
                  value={values.jumpAuthType}
                  onChange={updateField}
                >
                  <option value="key">私钥</option>
                  <option value="password">密码</option>
                </select>
                {renderError('jumpAuthType')}
              </label>
            </div>

            {values.jumpAuthType === 'password' ? (
              <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-300">
                <span>跳板机密码</span>
                <input
                  className={inputClassName('jumpPassword')}
                  name="jumpPassword"
                  type="password"
                  value={values.jumpPassword}
                  onChange={updateField}
                />
                {renderError('jumpPassword')}
              </label>
            ) : (
              <div className="mt-4 grid gap-1.5 text-sm font-medium text-slate-300">
                <label>跳板机私钥路径</label>
                <div className="flex gap-3 max-sm:flex-col">
                  <input
                    className={inputClassName('jumpKeyFilePath')}
                    name="jumpKeyFilePath"
                    value={values.jumpKeyFilePath}
                    onChange={updateField}
                  />
                  <button
                    type="button"
                    className="yogo-button-secondary shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition max-sm:w-full"
                    onClick={onSelectKeyFile}
                  >
                    选择文件
                  </button>
                </div>
                {renderError('jumpKeyFilePath')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Fixed Bottom */}
      <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-700/70 p-6 pt-4 max-sm:p-4 max-sm:pt-3 max-sm:flex-col">
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
