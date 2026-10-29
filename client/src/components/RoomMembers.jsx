import { Avatar, Badge, Card, OnlineIndicator, Skeleton } from "./ui";

// Room owner + students with live presence from GET /rooms/:id/members
// (refreshed every 30s by useRoomMembers). `members` is null until loaded.
function RoomMembers({ members, title = "In this room" }) {
  const list = members ? [{ ...members.owner, isOwner: true }, ...members.students] : [];
  const activeCount = list.filter((m) => m.active).length;

  return (
    <Card>
      <div className="row row-between" style={{ marginBottom: 12 }}>
        <h2 className="section__title">{title}</h2>
        {members && <span className="text-xs text-muted">{activeCount} active now</span>}
      </div>
      {!members ? (
        <div className="stack stack-sm" aria-label="Loading members">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={40} />
          ))}
        </div>
      ) : (
        <ul className="member-list" role="list">
          {list.map((m) => (
            <li key={`${m.isOwner ? "owner" : "student"}-${m.id}`} className="member-list__item">
              <Avatar name={m.name} size={36} online={m.active} />
              <div className="grow">
                <p className="text-sm font-semibold truncate">{m.name}</p>
                <OnlineIndicator online={m.active} />
              </div>
              {m.isOwner && <Badge tone="teacher">Teacher</Badge>}
            </li>
          ))}
          {list.length === 1 && <li className="text-sm text-muted">No classmates have joined yet.</li>}
        </ul>
      )}
    </Card>
  );
}

export default RoomMembers;
