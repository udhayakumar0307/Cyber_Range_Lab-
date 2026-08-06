import zipfile
import os

downloads_dir = 'C:/Users/Udhayakumar/Downloads'

for file in os.listdir(downloads_dir):
    if file.endswith('.zip'):
        zip_path = os.path.join(downloads_dir, file)
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                pngs = [name for name in zip_ref.namelist() if name.endswith('.png')]
                if pngs:
                    print(f"\nZIP: {file}")
                    for p in pngs:
                        print(f"  - {p}")
        except Exception as e:
            pass
