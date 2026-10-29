"use client";

import { Children, createContext, isValidElement, useCallback, useContext, useId, useState, useTransition, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Handle {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  /** dnd-kit's setActivatorNodeRef: the element that starts a drag. */
  activator: (el: HTMLElement | null) => void;
}
const HandleContext = createContext<Handle | null>(null);

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface SortableProps {
  id: string;
  /** The element's own id, for #anchors. */
  domId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A list of <Sortable> items, reordered by dragging each item's <DragHandle>
 * (or, from the keyboard: focus the handle, Space, arrow keys, Space). The new order is
 * saved as soon as an item is dropped; if the save is refused the list goes
 * back and the page reloads.
 */
export function SortableList({
  children,
  save,
  as = "ul",
  className,
}: {
  children: ReactNode;
  save: (ids: string[]) => Promise<boolean>;
  as?: "ul" | "div";
  className?: string;
}) {
  const items = Children.toArray(children).filter((c): c is ReactElement<SortableProps> => isValidElement(c));
  const ids = items.map((i) => i.props.id);
  const [order, setOrder] = useState(ids);
  const [synced, setSynced] = useState(ids.join());
  if (synced !== ids.join()) {
    // The page brought a new list (a save, an added row): it wins.
    setSynced(ids.join());
    setOrder(ids);
  }
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(items.map((i) => [i.props.id, i.props]));
  const Tag = as;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    setFailed(false);
    start(async () => {
      if (await save(next)) return;
      setOrder(ids);
      setFailed(true);
      router.refresh();
    });
  }

  return (
    <DndContext id={useId()} sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {failed ? (
          <p role="alert" className="mx-5 my-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-600/20 ring-inset">
            The new order wasn&apos;t saved: the list changed in the meantime. It has been reloaded; try again.
          </p>
        ) : null}
        <Tag className={className}>
          {order.map((id) => {
            const item = byId.get(id);
            return item ? <SortableItem key={id} {...item} as={as === "ul" ? "li" : "div"} /> : null;
          })}
        </Tag>
      </SortableContext>
    </DndContext>
  );
}

/** One item of a <SortableList>; the list renders it in the dragged order. */
export function Sortable(props: SortableProps) {
  // Placeholder: SortableList reads these props and renders SortableItem in its place.
  return <>{props.children}</>;
}

function SortableItem({ id, domId, className, children, as: Tag }: SortableProps & { as: "li" | "div" }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <Tag
      ref={setNodeRef}
      id={domId}
      style={{ transform: CSS.Translate.toString(transform), transition, position: "relative", zIndex: isDragging ? 30 : undefined }}
      className={`${className ?? ""} ${isDragging ? "rounded-xl bg-white shadow-lg ring-1 ring-brand-500" : ""}`}
    >
      <HandleContext.Provider value={{ attributes, listeners, activator: setActivatorNodeRef }}>{children}</HandleContext.Provider>
    </Tag>
  );
}

/** The ⋮⋮ grip that drags its item in a <SortableList>. */
export function DragHandle({ label }: { label: string }) {
  const h = useContext(HandleContext);
  const activator = useCallback((el: HTMLElement | null) => h?.activator(el), [h]);
  if (!h) return null;
  return (
    <button
      type="button"
      ref={activator}
      {...h.attributes}
      {...h.listeners}
      aria-label={label}
      title="Drag to reorder"
      // Inside a <summary>, a click would also open or close the section.
      onClick={(e) => e.preventDefault()}
      className="-ml-1.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-brand-500 active:cursor-grabbing"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-4 w-4">
        <circle cx="7" cy="4.5" r="1.5" />
        <circle cx="13" cy="4.5" r="1.5" />
        <circle cx="7" cy="10" r="1.5" />
        <circle cx="13" cy="10" r="1.5" />
        <circle cx="7" cy="15.5" r="1.5" />
        <circle cx="13" cy="15.5" r="1.5" />
      </svg>
    </button>
  );
}
