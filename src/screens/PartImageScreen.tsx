import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useParams } from "react-router";
import { clearPartImage, getPart, loadPartImage, loadPartThumbnail, readError, uploadPartImage } from "../api";
import { Notice } from "../Notice";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, PartDetail } from "../types";

const IMAGE_EVENT = "leaf-part-image";

const ratios = [
  { id: "1", label: "正方形 (1:1)", w: 1, h: 1 },
  { id: "4", label: "4:3", w: 4, h: 3 },
  { id: "16", label: "16:9", w: 16, h: 9 },
  { id: "3", label: "3:2", w: 3, h: 2 },
];

export function watchPartImage(pk: number, refresh: () => void) {
  const onChange = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === pk) {
      refresh();
    }
  };
  window.addEventListener(IMAGE_EVENT, onChange);
  return () => window.removeEventListener(IMAGE_EVENT, onChange);
}

function notifyPartImage(pk: number) {
  window.dispatchEvent(new CustomEvent(IMAGE_EVENT, { detail: pk }));
}

export function PartImageScreen() {
  const { serverId, setActions } = useShell();
  const params = useParams();
  const partPk = Number(params.partId);
  const invalid = !Number.isInteger(partPk) || partPk <= 0;
  const fileRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<(file: Blob, filename: string) => void>(() => {});
  const removeRef = useRef<() => void>(() => {});
  const [part, setPart] = useState<PartDetail | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "零件不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const next = await getPart(serverId, partPk);
      setPart(next);
      const full = next.image.trim();
      const thumb = next.thumbnail.trim();
      if (!full && !thumb) {
        setSrc(null);
      } else if (full) {
        setSrc(await loadPartImage(serverId, full).catch(() => (thumb ? loadPartThumbnail(serverId, thumb) : "")));
      } else {
        setSrc(await loadPartThumbnail(serverId, thumb));
      }
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, partPk]);

  async function send(file: Blob, filename: string) {
    setBusy(true);
    setError(null);
    try {
      await uploadPartImage(serverId, partPk, file, filename);
      setPicked(null);
      setCropping(false);
      notifyPartImage(partPk);
      await load();
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeImage() {
    if (!part?.image.trim() || !window.confirm("您确认要删除此图片吗？")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clearPartImage(serverId, partPk);
      notifyPartImage(partPk);
      await load();
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  }

  sendRef.current = (file, filename) => {
    if (!busy) {
      void send(file, filename);
    }
  };
  removeRef.current = () => {
    if (!busy) {
      void removeImage();
    }
  };

  useEffect(() => {
    if (loading || cropping) {
      if (loading && !cropping) {
        setActions([]);
      }
      return;
    }
    if (picked) {
      const file = picked;
      setActions([
        { id: "crop-image", label: "裁剪", onSelect: () => setCropping(true) },
        {
          id: "use-original",
          label: "使用原始文件",
          onSelect: () => sendRef.current(file, file.name || "part-image"),
        },
        { id: "cancel-image", label: "取消", onSelect: () => setPicked(null) },
      ]);
      return () => setActions([]);
    }
    const next = [
      {
        id: "upload-image",
        label: busy ? "正在上传…" : "上传图片",
        onSelect: () => {
          if (!busy && !invalid) {
            fileRef.current?.click();
          }
        },
      },
    ];
    if (part?.image.trim()) {
      next.push({
        id: "delete-image",
        label: "删除图片",
        onSelect: () => removeRef.current(),
      });
    }
    setActions(next);
    return () => setActions([]);
  }, [loading, cropping, picked, busy, invalid, part?.image, setActions]);

  return (
    <div className="part-image-page">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取图片…</p> : null}
      {cropping && picked ? (
        <ImageCropper
          file={picked}
          busy={busy}
          onCancel={() => setCropping(false)}
          onDone={(blob) => void send(blob, "part-image.jpg")}
        />
      ) : (
        <>
          <div className="part-image-view">
            {src ? <img alt="" src={src} /> : !loading ? <p className="muted">还没有图片</p> : null}
          </div>
          {busy ? <p className="muted">正在上传…</p> : null}
        </>
      )}
      <input
        ref={fileRef}
        className="file-input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          if (!file) {
            return;
          }
          setPicked(file);
          setCropping(false);
        }}
      />
      {picked && !cropping ? (
        <div className="image-choice" onClick={(event) => event.stopPropagation()}>
          <strong>裁剪图片</strong>
          <p>您想要在上传前裁剪此图像吗？请从行动菜单选择。</p>
        </div>
      ) : null}
    </div>
  );
}

function ImageCropper({
  file,
  busy,
  onCancel,
  onDone,
}: {
  file: File;
  busy: boolean;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState(ratios[0]);
  const [userScale, setUserScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const { setActions } = useShell();
  const doneRef = useRef<() => void>(() => {});
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    setUserScale(1);
    setOffset({ x: 0, y: 0 });
    setFailed(false);
    const image = new Image();
    image.onload = () => setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    image.onerror = () => setFailed(true);
    image.src = next;
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return;
    }
    const measure = () => setStage({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const frame = layoutCrop(stage.w, stage.h, natural.w, natural.h, ratio.w / ratio.h, userScale, offset);

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) {
      return;
    }
    const next = {
      x: current.ox + event.clientX - current.x,
      y: current.oy + event.clientY - current.y,
    };
    const placed = layoutCrop(stage.w, stage.h, natural.w, natural.h, ratio.w / ratio.h, userScale, next);
    const centeredLeft = (stage.w - placed.imgW) / 2;
    const centeredTop = (stage.h - placed.imgH) / 2;
    setOffset({ x: placed.left - centeredLeft, y: placed.top - centeredTop });
  }

  function finishCrop() {
    const image = new Image();
    image.onload = () => {
      const placed = layoutCrop(stage.w, stage.h, image.naturalWidth, image.naturalHeight, ratio.w / ratio.h, userScale, offset);
      const pixelScale = image.naturalWidth / placed.imgW;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(placed.cropW * pixelScale));
      canvas.height = Math.max(1, Math.round(placed.cropH * pixelScale));
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.drawImage(
        image,
        (placed.cropLeft - placed.left) * pixelScale,
        (placed.cropTop - placed.top) * pixelScale,
        placed.cropW * pixelScale,
        placed.cropH * pixelScale,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      canvas.toBlob((blob) => {
        if (blob) {
          onDone(blob);
        }
      }, "image/jpeg", 0.9);
    };
    image.src = url;
  }

  doneRef.current = () => {
    if (!busy && !failed && natural.w > 0 && stage.w > 0) {
      finishCrop();
    }
  };

  useEffect(() => {
    setActions([
      {
        id: "finish-crop",
        label: busy ? "正在上传…" : "完成",
        onSelect: () => doneRef.current(),
      },
      { id: "cancel-crop", label: "取消", onSelect: () => cancelRef.current() },
    ]);
    return () => setActions([]);
  }, [busy, setActions]);

  return (
    <>
      <div className="ratio-row">
        {ratios.map((item) => (
          <button
            key={item.id}
            className={item.id === ratio.id ? "ratio-chip is-on" : "ratio-chip"}
            type="button"
            onClick={() => {
              setRatio(item);
              setOffset({ x: 0, y: 0 });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        ref={stageRef}
        className="crop-stage"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {url && !failed ? (
          <img alt="" src={url} style={{ width: frame.imgW, height: frame.imgH, left: frame.left, top: frame.top }} />
        ) : null}
        <div className="crop-window" style={{ width: frame.cropW, height: frame.cropH, left: frame.cropLeft, top: frame.cropTop }} />
      </div>
      {failed ? <p className="muted">这张图片无法裁剪，可以直接使用原始文件。</p> : null}
      <div className="ratio-row">
        <button className="ratio-chip" type="button" onClick={() => setUserScale((value) => Math.max(1, value * 0.75))}>
          缩小
        </button>
        <button className="ratio-chip" type="button" onClick={() => setUserScale((value) => Math.min(4, value / 0.75))}>
          放大
        </button>
        <button
          className="ratio-chip"
          type="button"
          onClick={() => {
            setUserScale(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          重置
        </button>
      </div>
    </>
  );
}

function layoutCrop(
  stageW: number,
  stageH: number,
  natW: number,
  natH: number,
  aspect: number,
  userScale: number,
  offset: { x: number; y: number },
) {
  const empty = { cropW: 0, cropH: 0, cropLeft: 0, cropTop: 0, imgW: 0, imgH: 0, left: 0, top: 0 };
  if (stageW <= 0 || stageH <= 0 || natW <= 0 || natH <= 0) {
    return empty;
  }
  let cropW = stageW * 0.86;
  let cropH = cropW / aspect;
  if (cropH > stageH * 0.72) {
    cropH = stageH * 0.72;
    cropW = cropH * aspect;
  }
  const cover = Math.max(cropW / natW, cropH / natH);
  const imgW = natW * cover * userScale;
  const imgH = natH * cover * userScale;
  const cropLeft = (stageW - cropW) / 2;
  const cropTop = (stageH - cropH) / 2;
  const left = clamp((stageW - imgW) / 2 + offset.x, cropLeft + cropW - imgW, cropLeft);
  const top = clamp((stageH - imgH) / 2 + offset.y, cropTop + cropH - imgH, cropTop);
  return { cropW, cropH, cropLeft, cropTop, imgW, imgH, left, top };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
