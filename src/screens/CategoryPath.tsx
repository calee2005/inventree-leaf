import { useEffect, useState } from "react";
import { Menu, MenuButton, MenuItem, SubMenu } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import { listPartCategories } from "../api";
import type { CategorySummary } from "../types";

type Props = {
  serverId: string;
  trail: CategorySummary[];
  onOpen: (next: CategorySummary[]) => void;
};

export function CategoryPath({ serverId, trail, onOpen }: Props) {
  return (
    <div className="crumbs-wrap">
      <Menu
        portal
        unmountOnClose
        align="start"
        direction="bottom"
        viewScroll="close"
        menuClassName="category-path-menu"
        menuButton={
          <MenuButton className="icon-button path-more" aria-label="展开分类">
            <GridIcon />
          </MenuButton>
        }
      >
        <MenuItem onClick={() => onOpen([])}>全部</MenuItem>
        <CategoryLevel serverId={serverId} parent={null} prefix={[]} onOpen={onOpen} />
      </Menu>
      <nav className="crumbs" aria-label="类别">
        <button className="crumb" type="button" onClick={() => onOpen([])}>
          全部
        </button>
        {trail.map((item, index) => (
          <span className="crumb-group" key={item.pk}>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <button className="crumb" type="button" onClick={() => onOpen(trail.slice(0, index + 1))}>
              {item.name || "未命名类别"}
            </button>
          </span>
        ))}
      </nav>
    </div>
  );
}

function CategoryLevel({
  serverId,
  parent,
  prefix,
  onOpen,
}: {
  serverId: string;
  parent: number | null;
  prefix: CategorySummary[];
  onOpen: (next: CategorySummary[]) => void;
}) {
  const [items, setItems] = useState<CategorySummary[] | null>(null);

  useEffect(() => {
    let active = true;
    listPartCategories(serverId, parent, 0)
      .then((page) => {
        if (active) {
          setItems(page.results);
        }
      })
      .catch(() => {
        if (active) {
          setItems([]);
        }
      });
    return () => {
      active = false;
    };
  }, [serverId, parent]);

  if (!items) {
    return <MenuItem disabled>正在读取…</MenuItem>;
  }
  return items.map((item) => (
    <CategoryNode key={item.pk} serverId={serverId} item={item} prefix={prefix} onOpen={onOpen} />
  ));
}

function CategoryNode({
  serverId,
  item,
  prefix,
  onOpen,
}: {
  serverId: string;
  item: CategorySummary;
  prefix: CategorySummary[];
  onOpen: (next: CategorySummary[]) => void;
}) {
  const [opened, setOpened] = useState(false);
  const name = item.name || "未命名类别";
  const next = [...prefix, item];

  return (
    <SubMenu
      label={name}
      openTrigger="clickOnly"
      onMenuChange={(event) => setOpened(event.open)}
    >
      <MenuItem onClick={() => onOpen(next)}>{name}</MenuItem>
      {opened ? <CategoryLevel serverId={serverId} parent={item.pk} prefix={next} onOpen={onOpen} /> : null}
    </SubMenu>
  );
}

function GridIcon() {
  return (
    <svg className="grid-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </svg>
  );
}
