import { useEffect, useState } from "react";
import { currentUser, listServers, readError, serverStatus } from "../api";
import { Notice } from "../Notice";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, ServerInfo, SessionUser } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailRow } from "../ui/DetailRow";
import { SectionLabel } from "../ui/SectionLabel";
import pkg from "../../package.json";

export function AboutScreen() {
  const { serverId } = useShell();
  const [address, setAddress] = useState("");
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([listServers(), serverStatus(serverId), currentUser(serverId)])
      .then(([servers, status, session]) => {
        if (!active) {
          return;
        }
        setAddress(servers.find((item) => item.id === serverId)?.server ?? "");
        setInfo(status);
        setUser(session);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(readError(reason));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [serverId]);

  const fullName = [user?.firstName ?? "", user?.lastName ?? ""].filter((part) => part.trim()).join(" ");

  return (
    <div className="detail-stack subpage-top">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取服务器信息…</p> : null}
      {info ? (
        <>
          <SectionLabel>服务器详情</SectionLabel>
          <DetailGroup>
            <DetailRow title="地址" detail={address || "未连接"} />
            <DetailRow title="版本" detail={info.version} />
            <DetailRow title="API 版本" detail={String(info.apiVersion)} />
            <DetailRow title="服务器实例" detail={info.instance.trim() || "未命名"} />
            <DetailRow title="插件支持" detail={pluginDetail(info.pluginsEnabled)} />
            {info.workerRunning === null ? null : (
              <DetailRow title="后台任务" detail={info.workerRunning ? "运行中" : "未运行"} />
            )}
          </DetailGroup>
          <SectionLabel>用户详情</SectionLabel>
          <DetailGroup>
            <DetailRow title="用户名" detail={user?.username || "未登录"} />
            {user?.email.trim() ? <DetailRow title="电子邮件" detail={user.email} /> : null}
            {fullName ? <DetailRow title="名称" detail={fullName} /> : null}
          </DetailGroup>
        </>
      ) : null}
      <SectionLabel>应用详情</SectionLabel>
      <DetailGroup>
        <DetailRow title="名称" detail="InvenTree Leaf" />
        <DetailRow title="版本" detail={pkg.version} />
      </DetailGroup>
    </div>
  );
}

function pluginDetail(enabled: boolean | null) {
  if (enabled === false) {
    return "未启用插件支持";
  }
  if (enabled === true) {
    return "已启用插件支持";
  }
  return "服务器支持自定义插件";
}
