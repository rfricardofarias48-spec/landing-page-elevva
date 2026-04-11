import * as Avatar from "@radix-ui/react-avatar";

const avatarData = [
  { name: "AM", imgURL: "https://randomuser.me/api/portraits/women/79.jpg" },
  { name: "TN", imgURL: "https://randomuser.me/api/portraits/men/32.jpg" },
  { name: "CM", imgURL: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "RS", imgURL: "https://randomuser.me/api/portraits/men/18.jpg" },
  { name: "JP", imgURL: "https://randomuser.me/api/portraits/men/86.jpg" },
];

export function SocialProofAvatars() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center -space-x-2">
        {avatarData.map((item, idx) => (
          <Avatar.Root
            key={idx}
            className="border-2 border-white h-9 w-9 flex items-center justify-center overflow-hidden rounded-full shadow-sm"
          >
            <Avatar.Image
              src={item.imgURL}
              alt={`${item.name} avatar`}
              className="h-full w-full object-cover"
            />
            <Avatar.Fallback
              delayMs={600}
              className="bg-slate-100 text-slate-600 text-xs font-bold w-full h-full flex items-center justify-center"
            >
              {item.name}
            </Avatar.Fallback>
          </Avatar.Root>
        ))}
      </div>
      <p className="text-sm text-slate-500 font-medium">
        + de <span className="text-slate-900 font-black">100 usuários</span>
      </p>
    </div>
  );
}
