import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getPart, getPartPricing, readError } from "../api";
import { PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, PartDetail, PartPriceDetail } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";

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
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取价格…</p> : null}
      <PullToRefresh
        onRefresh={async () => {
          setLoading(false);
          await load();
        }}
      >
        <div className="detail-stack">
          {part ? <DetailHeading title={part.fullName || part.name} detail={part.description || undefined} /> : null}
          {missing ? <DetailHeading title="无可用价格" detail="未找到此零件的定价数据" /> : null}
          {rows.length > 0 ? (
            <DetailGroup>
              {rows.map((row) => (
                <DetailRow key={row.title} title={row.title} aside={row.value} />
              ))}
            </DetailGroup>
          ) : null}
          {part?.salable && pricing ? (
            <DetailGroup>
              <DetailRow title="销售价格" aside={pricing.salePrice || "-"} />
              <DetailRow title="销售历史" aside={pricing.saleHistory || "-"} />
            </DetailGroup>
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
