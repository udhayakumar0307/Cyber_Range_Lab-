import zipfile
import os

zip_path = 'C:/Users/Udhayakumar/Downloads/ot-security-labs.zip'
dest_path = 'c:/Users/Udhayakumar/Downloads/backup/backup/backend/app/assets/certificates/certificate_master.png'

if os.path.exists(zip_path):
    print(f"Opening {zip_path}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        for name in zip_ref.namelist():
            if 'certificate_master' in name:
                print(f"Found in zip: {name}")
                with zip_ref.open(name) as source, open(dest_path, 'wb') as dest:
                    dest.write(source.read())
                print(f"Successfully extracted {name}!")
                break
else:
    print(f"{zip_path} does not exist!")
