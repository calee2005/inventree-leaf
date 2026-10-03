import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getPart, getPartPricing, readError } from "../api";
import { PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, PartDetail, PartPriceDetail } from "../types";

export function PartPricingScreen() {
  const { serverId } = useShell();
  const params = useParams();
  const partPk = Number(params.partId);
  const invalid = !Number.isInteger(partPk) || partPk <= 0;
  const [part, setPart] = useState<PartDetail | null>(null);
  const [pricing, setPricing] = useState<PartPriceDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "零件不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    const [partResult, priceResult] = await Promise.allSettled([
      getPart(serverId, partPk),
      getPartPricing(serverId, partPk),
    ]);
    if (partResult.status === "fulfilled") {
      setPart(partResult.value);
    } else {
      setPart(null);
      setError(readError(partResult.reason));
    }
    if (priceResult.status === "fulfilled") {
      setPricing(priceResult.value);
      setMissing(false);
    } else {
      setPricing(null);
      setMissing(true);
      if (partResult.status === "fulfilled") {
        setError(null);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, partPk]);

  const rows = pricing && part ? priceRows(part, pricing) : [];

  return (
    <div className="part-detail part-pricing">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取价格…</p> : null}
      <PullToRefresh
        onRefresh={async () => {
          setLoading(false);
          await load();
        }}
      >
        <div className="detail-stack">
          {part ? (
            <div className="detail-heading">
              <strong>{part.fullName || part.name}</strong>
              {part.description ? <p className="detail-spec">{part.description}</p> : null}
            </div>
          ) : null}
          {missing ? (
            <div className="detail-heading">
              <strong>无可用价格</strong>
              <p className="detail-spec">未找到此零件的定价数据</p>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <div className="detail-group">
              {rows.map((row) => (
                <div className="detail-row" key={row.title}>
                  <span className="detail-copy">
                    <strong>{row.title}</strong>
                  </span>
                  <span className="detail-aside">{row.value}</span>
                </div>
              ))}
            </div>
          ) : null}
          {part?.salable && pricing ? (
            <div className="detail-group">
              <PriceLine title="销售价格" value={pricing.salePrice} />
              <PriceLine title="销售历史" value={pricing.saleHistory} />
            </div>
          ) : null}
        </div>
      </PullToRefresh>
    </div>
  );
}

function priceRows(part: PartDetail, pricing: PartPriceDetail) {
  const rows = [
    { title: "币种", value: pricing.currency || "-" },
    { title: "价格范围", value: pricing.priceRange || "-" },
  ];
  if (pricing.overrideMin) {
    rows.push({ title: "最低价格覆盖", value: pricing.overrideMin });
  }
  if (pricing.overrideMax) {
    rows.push({ title: "最高自定义价格", value: pricing.overrideMax });
  }
  rows.push({ title: "内部成本", value: pricing.internalCost || "-" });
  if (part.isTemplate) {
    rows.push({ title: "变体成本", value: pricing.variantCost || "-" });
  }
  if (part.assembly) {
    rows.push({ title: "物料清单成本", value: pricing.bomCost || "-" });
  }
  if (part.purchaseable) {
    rows.push({ title: "采购价格", value: pricing.purchasePrice || "-" });
    rows.push({ title: "供应商价格", value: pricing.supplierPrice || "-" });
  }
  return rows;
}

function PriceLine({ title, value }: { title: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-copy">
        <strong>{title}</strong>
      </span>
      <span className="detail-aside">{value || "-"}</span>
    </div>
  );
}
