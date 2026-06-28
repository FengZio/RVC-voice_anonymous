import React from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import AuthMascot from '../../components/AuthMascot.jsx';
import Pill from '../../components/Pill.jsx';
import { apiForm } from '../../utils/api.js';
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY, STORAGE_ROLE_KEY } from '../../constants.js';

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = React.useState('login');
  const [role, setRole] = React.useState('patient');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [focusField, setFocusField] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('username', username);
      form.append('password', password);
      if (mode === 'register') {
        form.append('display_name', displayName);
        form.append('role', role);
        form.append('title', title);
        form.append('department', department);
      }
      const data = await apiForm(mode === 'register' ? '/api/auth/register' : '/api/auth/login', form);
      localStorage.setItem(STORAGE_TOKEN_KEY, data.token);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_ROLE_KEY, data.user.role);
      onAuthed(data.user, data.token);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const filled = [username, password, displayName, title, department].filter((item) => item.trim()).length;
  const isRegister = mode === 'register';
  return (
    <main className="authShell">
      <section className="authCanvas">
        <div className="authPanel authPanel-visual">
          <AuthMascot
            mode={mode}
            role={role}
            focusField={focusField}
            filled={filled}
            password={password}
            showPassword={showPassword}
          />
          <div className="authSignalRow">
            <Pill tone={isRegister ? 'accent' : 'neutral'}>{isRegister ? '创建新身份' : '欢迎回来'}</Pill>
            <Pill tone={role === 'doctor' ? 'success' : 'accent'}>{role === 'doctor' ? '医生入口' : '患者入口'}</Pill>
            <Pill tone={filled > 2 ? 'success' : 'neutral'}>{filled > 2 ? '资料已补全' : '轻触表单即可互动'}</Pill>
          </div>
        </div>

        <section className="authPanel authPanel-form">
          <div className="authHero">
            <h1>{isRegister ? '创建你的导诊身份' : '欢迎回来'}</h1>
            <p>{isRegister ? '先登记角色，再进入患者端或医生端。' : '输入账号后继续进入系统。'}</p>
          </div>

          <form className="authForm" onSubmit={submit}>
            <div className="segmented segmented-auth">
              <button className={mode === 'login' ? 'segActive' : ''} type="button" onClick={() => setMode('login')}>
                登录
              </button>
              <button className={mode === 'register' ? 'segActive' : ''} type="button" onClick={() => setMode('register')}>
                注册
              </button>
            </div>

            {mode === 'register' ? (
              <label className="field">
                <span>身份类型</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  onFocus={() => setFocusField('role')}
                  onBlur={() => setFocusField('')}
                >
                  <option value="patient">患者</option>
                  <option value="doctor">医生</option>
                </select>
              </label>
            ) : null}

            <label className="field">
              <span>{isRegister ? '用户名' : '账号'}</span>
              <div className="inputShell">
                <Mail size={16} />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusField('username')}
                  onBlur={() => setFocusField('')}
                  placeholder={isRegister ? '请输入用户名' : '请输入账号'}
                />
              </div>
            </label>

            <label className="field">
              <span>密码</span>
              <div className="inputShell">
                <Lock size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusField('password')}
                  onBlur={() => setFocusField('')}
                  placeholder="请输入密码"
                />
                <button className="passwordToggle" type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {mode === 'register' ? (
              <>
                <label className="field">
                  <span>显示名称</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onFocus={() => setFocusField('displayName')}
                    onBlur={() => setFocusField('')}
                    placeholder={role === 'doctor' ? '如：李医生' : '如：小林'}
                  />
                </label>
                {role === 'doctor' ? (
                  <>
                    <label className="field">
                      <span>职称</span>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onFocus={() => setFocusField('title')}
                        onBlur={() => setFocusField('')}
                        placeholder="主任医师 / 住院医师"
                      />
                    </label>
                    <label className="field">
                      <span>科室</span>
                      <input
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        onFocus={() => setFocusField('department')}
                        onBlur={() => setFocusField('')}
                        placeholder="心理科 / 精神科 / 全科"
                      />
                    </label>
                  </>
                ) : null}
              </>
            ) : null}

            {error ? <div className="errorBanner">{error}</div> : null}
            <div className="formFooter">
              <label className="rememberRow">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span>记住我 30 天</span>
              </label>
              <button
                className="textButton"
                type="button"
                onClick={() => setMode(isRegister ? 'login' : 'register')}
              >
                {isRegister ? '回到登录' : '先试试注册'}
              </button>
            </div>
            <button className="primaryButton wide" disabled={busy} type="submit">
              {busy ? '处理中' : mode === 'register' ? '创建账号' : '进入系统'}
            </button>
          </form>
          <div className="authFooterRow">
            <span>{rememberMe ? '已开启记住我' : '未保存本次登录'}</span>
            <span>鼠标移动和输入都会改变角色状态。</span>
          </div>
        </section>
      </section>
    </main>
  );
}
