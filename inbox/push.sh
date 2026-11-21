#!/usr/bin/env bash
# inbox/push.sh — يرفع الفيديو الخام إلى فرع المونتاج في VitoAI عبر git مباشرة.
#
#   سقف 25 MB يخصّ صفحة الرفع على الإنترنت؛ git لا يعرفه. سقف git هو 100 MB للملف الواحد،
#   والبايتات تصل كما خرجت: لا إعادة ترميز، ولا تغيير دقة، ولا اسم يُحرَّف.
#
# الاستعمال:
#   bash push.sh /path/video.mp4             ملف واحد (≤ 100 MB)
#   bash push.sh /path/folder-of-parts       مجلد أجزاء split.html كله بما فيه MANIFEST
#
# يتطلب git 2.25+ مسجّل الدخول على حساب GitHub (اسم مستخدم + Personal Access Token).
set -euo pipefail

REPO="${VITO_INBOX_REPO:-https://github.com/vitobytestudio/vitoai.git}"
BRANCH="${VITO_INBOX_BRANCH:-arena/c36750ba-vitoai}"
DIR="inbox"
MAX=$((100 * 1024 * 1024))
die() { echo "✗ $*" >&2; exit "${2:-1}"; }

hash16() {  # بصمة قصيرة تُقارَن بعد السحب — SHA-256 بأية أداة متوفرة
  { sha256sum "$1" 2>/dev/null || shasum -a 256 "$1" 2>/dev/null || certutil -hashfile "$1" SHA256 2>/dev/null; } \
    | tr 'A-F' 'a-f' | grep -oE '[0-9a-f]{16}' | head -1
}
size_of() { wc -c <"$1" | tr -d ' '; }

src="${1:-}"
[[ -n "$src" && -e "$src" ]] || die "الاستعمال: bash push.sh /path/to/video.mp4   أو   bash push.sh /path/folder-of-parts" 2

files=()
if [[ -d "$src" ]]; then
  while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$src" -maxdepth 1 -type f -print0 | sort -z)
  [[ ${#files[@]} -gt 0 ]] || die "المجلد لا يحوي ملفات: $src" 2
elif [[ -f "$src" ]]; then
  files+=("$src")
else
  die "لا ملف ولا مجلد: $src" 2
fi

total=0
for f in "${files[@]}"; do
  b=$(size_of "$f")
  if (( b > MAX )); then
    printf '✗ %s حجمه %s ميغابايت — فوق سقف GitHub لكل ملف (100 MB) حتى عبر git.\n' \
      "$(basename "$f")" "$(awk -v x="$b" 'BEGIN{printf "%.0f", x/1048576}')" >&2
    die "قطّعه بـ inbox/split.html إلى أجزاء ≤24 MB ثم ارفع المجلد كله بهذه الأداة، أو أرسله في المحادثة." 3
  fi
  total=$(( total + b ))
done
printf '→ %d ملف · %.1f ميغابايت إجمالاً\n' "${#files[@]}" "$(awk -v t="$total" 'BEGIN{print t/1048576}')"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
echo "→ نسخ خفيف للفرع — بلا تنزيل وسائط المستودع"
git clone -q --filter=blob:none --no-checkout --single-branch -b "$BRANCH" "$REPO" "$tmp" 2>/dev/null \
  || die "تعذّر النسخ — غالباً تسجيل دخول GitHub. اختبره بـ:  git clone $REPO" 5
cd "$tmp"
git config user.name  >/dev/null 2>&1 || git config user.name  "vitoai-inbox"
git config user.email >/dev/null 2>&1 || git config user.email "inbox@vitoai.local"
# sparse-checkout وليس --no-checkout وحده: الفهرس يجب أن يحمل الشجرة كاملة،
# وإلا صار الـ commit شجرةً فيها ملفنا فقط — أي حذفٌ للمشروع كله. انظر PITFALLS.
git sparse-checkout set --no-cone "/$DIR" >/dev/null 2>&1 || true
git checkout -q "$BRANCH"
before=$(git ls-tree -r HEAD --name-only | wc -l | tr -d ' ')
# حارس الأساس: commit بصيغة صحيحة فوق شجرة ناقصة يدمّر المشروع، كما فعل أول اختبار لهذا السكربت.
for a in package.json src/index.ts "$DIR/README.md"; do
  git cat-file -e "HEAD:$a" 2>/dev/null || die "الأساس المنسوخ لا يحوي $a — الفرع تالف أو مقلّص؛ لن أضيف فوقه." 4
done

mkdir -p "$DIR"
msg_lines=""
for f in "${files[@]}"; do
  n=$(basename "$f")
  cp "$f" "$DIR/$n"
  git add -f "$DIR/$n"
  printf '   + %-40s %11s بايت  sha256 %s…\n' "$n" "$(size_of "$f")" "$(hash16 "$f")"
  msg_lines+="  $n  $(size_of "$f")  sha256 $(hash16 "$f")"$'\n'
done
git commit -q -m "inbox: raw footage for the cut — ${#files[@]} ملف، $total بايت
$(printf '%s' "$msg_lines")"

# ── حرّاس: ما دُفع إضافةٌ فقط، بلا حذف ولا تعديل ولا مفاجآت ─────────────────────
status=$(git diff --name-status HEAD~1 HEAD)
notadd=$(printf '%s\n' "$status" | awk 'NF && $1 != "A" {c++} END{print c+0}')
added=$(printf '%s\n' "$status" | awk 'NF && $1 == "A"' | wc -l | tr -d ' ')
after=$(git ls-tree -r HEAD --name-only | wc -l | tr -d ' ')
[[ "$notadd" == "0" ]] || die "الـ commit يحوي حذف/تعديل ($notadd مسارات) — لن أدفعه. أرسل لي ما طبعته هذه الأداة." 4
[[ "$after" == "$((before + added))" ]] || die "عدد المسارات بعد الرفع ($after) ≠ قبله ($before) + المضاف ($added) — لن أدفعه." 4
echo "   ✓ حرّاس: $before → $after مسارات، ${added} إضافة، صفر حذف"

git push -q origin "HEAD:$BRANCH"
echo "✓ وصل إلى $BRANCH/$DIR/ — اكتب «تم» في المحادثة: أسحبه، أتحقق من البصمة، ثم أبدأ القصّ."
