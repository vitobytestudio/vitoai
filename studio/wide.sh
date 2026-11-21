#!/bin/bash
# النسخةُ العريضةُ 1920×1080: الصورةُ في الوسطِ بلا قصّ، وحوافُّها المُغلَّطةُ خلفَها
# تعبئةٌ مولَّدةٌ من الإطارِ نفسِه (blur-fill). الصوتُ يُنسخُ من الماسترِ النهائي، لذا
# تُشغَّلُ بعدَ studio/tp_limit.sh لا قبله — وإلّا خرجَ الماسترانِ بمستويين مختلفين.
cd "$(dirname "$0")/.." && source .toolenv
V=${V:-deliverables/vito-corp-1080x1920.mp4}
W=${W:-deliverables/vito-corp-1920x1080.mp4}
[ -s "$V" ] || { echo "✗ ناقص: $V" >&2; exit 1; }
"$FFMPEG" -v error -y -i "$V" -vf "split=2[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=32,eq=brightness=-0.06[b];\
[fg]scale=-2:1080[p];[b][p]overlay=(W-w)/2:0,setsar=1" -c:v libx264 -preset medium -b:v 5400k -maxrate 7000k -bufsize 10M \
  -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a copy -movflags +faststart "$W"
echo "  ✔ $W ($(stat -c%s "$W") B)"
