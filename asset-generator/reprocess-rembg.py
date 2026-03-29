import os
import sys
from pathlib import Path
from rembg import remove, new_session
from PIL import Image
import io

sys.stdout.reconfigure(encoding='utf-8')

TARGET_SIZE = 512
session = new_session("u2net")

def process_file(raw_path, out_path, size=TARGET_SIZE):
    with open(raw_path, "rb") as f:
        input_data = f.read()

    output_data = remove(input_data, session=session)

    # 리사이즈
    img = Image.open(io.BytesIO(output_data)).convert("RGBA")

    # contain 방식: 비율 유지하며 크기 맞춤, 투명 패딩
    img.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y))
    canvas.save(out_path)

def process_dir(base_dir, label):
    count = 0
    if not os.path.exists(base_dir):
        return count

    for root, dirs, files in os.walk(base_dir):
        for f in sorted(files):
            if f.endswith("_raw.png"):
                raw_path = os.path.join(root, f)
                out_path = os.path.join(root, f.replace("_raw.png", ".png"))
                try:
                    process_file(raw_path, out_path)
                    count += 1
                except Exception as e:
                    print(f"  ERROR: {raw_path}: {e}")

    print(f"  {label}: {count} frames")
    return count

def main():
    total = 0
    print("AI Background Removal (rembg/U2Net)\n")

    # 주인공
    total += process_dir("./output/player_final", "Player")

    # 잡졸
    total += process_dir("./output/enemies", "Enemies")

    # 보스
    total += process_dir("./output/bosses", "Bosses")

    # 장비
    total += process_dir("./output/equipment", "Equipment")

    # 수련 도구
    total += process_dir("./output/tools", "Tools")

    # UI 이펙트 (256px)
    if os.path.exists("./output/ui/effects"):
        count = 0
        for root, dirs, files in os.walk("./output/ui/effects"):
            for f in sorted(files):
                if f.endswith("_raw.png"):
                    raw_path = os.path.join(root, f)
                    out_path = os.path.join(root, f.replace("_raw.png", ".png"))
                    try:
                        process_file(raw_path, out_path, size=256)
                        count += 1
                    except Exception as e:
                        print(f"  ERROR: {raw_path}: {e}")
        print(f"  Effects: {count} frames")
        total += count

    # UI 아이콘 (128px)
    if os.path.exists("./output/ui/icons"):
        count = 0
        for f in sorted(os.listdir("./output/ui/icons")):
            if f.endswith("_raw.png"):
                raw_path = os.path.join("./output/ui/icons", f)
                out_path = raw_path.replace("_raw.png", ".png")
                try:
                    process_file(raw_path, out_path, size=128)
                    count += 1
                except Exception as e:
                    print(f"  ERROR: {raw_path}: {e}")
        print(f"  Icons: {count} frames")
        total += count

    print(f"\nTotal: {total} frames processed")

if __name__ == "__main__":
    main()
