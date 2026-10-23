# مخطط قاعدة البيانات — المرحلة الثانية

```text
auth.users 1──1 profiles
profiles 1──* follows (follower_id / following_id)
profiles 1──* blocks (blocker_id / blocked_id)
profiles 1──* communities (owner_id)
communities 1──* community_members *──1 profiles
profiles 1──* rooms (owner_id)
communities 1──* rooms (optional community_id)
rooms 1──* room_members *──1 profiles
profiles 1──* reports
profiles 1──* notifications
```

## حدود المرحلة

- العضوية الفعالة هي `community_members.status = 'active'`.
- العضو النشط في الغرفة هو السجل الذي تكون فيه `room_members.left_at is null`.
- الغرفة الخاصة لا تملك نظام دعوات في هذه migration؛ لذلك لا ينبغي إطلاق مشاركة روابطها قبل إضافة جدول invitations ودوال التحقق.
- البلاغات تحفظ هوية المُبلّغ وتمنع التكرار على نفس الهدف، لكن أدوات المشرف وسجل القرارات لم تُنفّذ بعد.
- لا يوجد اعتماد على عدد مستمعين مخزن؛ العدد الصحيح يحسب من `room_members` النشطين، ويمكن إضافة view/cache لاحقًا بعد القياس.
