export type RoomCategory = "الكل" | "سوالف" | "قصص" | "ألعاب" | "مجتمع";
export type RoomType = Exclude<RoomCategory, "الكل">;

export type RoomPreview = {
  id: string;
  title: string;
  category: RoomType;
  host: string;
  listeners: number;
  accent: string;
  description: string;
};

export const categories: RoomCategory[] = ["الكل", "سوالف", "قصص", "ألعاب", "مجتمع"];

// Development-only content. It must be replaced by a trusted repository in a later phase.
export const previewRooms: RoomPreview[] = [
  { id: "room-1", title: "قهوة آخر الليل", category: "سوالف", host: "مجلس الأصدقاء", listeners: 28, accent: "#D7AE52", description: "مساحة هادئة للتعارف والسوالف باحترام" },
  { id: "room-2", title: "اختَر نهاية الحكاية", category: "قصص", host: "حكّاؤون", listeners: 16, accent: "#A78BFA", description: "كل قرار منكم يغيّر مجرى القصة" },
  { id: "room-3", title: "تحدّي الألغاز", category: "ألعاب", host: "فريق الذكاء", listeners: 12, accent: "#55D6A4", description: "ألغاز سريعة وتحديات جماعية" },
  { id: "room-4", title: "مجتمع صُنّاع الأفكار", category: "مجتمع", host: "مساحة الإبداع", listeners: 9, accent: "#67B7F7", description: "شارك فكرة، تعلّم شيئًا، وتعرّف على أشخاص جدد" },
];
