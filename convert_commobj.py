import os, shutil
base = r'D:\chungbin\ycIDE-html\支持库源码\commobj'
src_elib = r'D:\chungbin\ycIDE-html\支持库源码\krnln\elib'
dst_elib = os.path.join(base, 'elib')

files = []
for f in os.listdir(base):
    if f.endswith(('.cpp','.h')):
        files.append(os.path.join(base, f))
cpp_dir = os.path.join(base, 'cppCode')
for f in os.listdir(cpp_dir):
    if f.endswith(('.cpp','.h')):
        files.append(os.path.join(cpp_dir, f))

converted = 0
for path in files:
    data = open(path,'rb').read()
    if data[:3] == b'\xef\xbb\xbf':
        continue
    try:
        text = data.decode('gbk')
        open(path,'wb').write(b'\xef\xbb\xbf' + text.encode('utf-8'))
        converted += 1
    except Exception as e:
        print(f'FAIL: {path}: {e}')

for f in ['lib2.h','fnshare.h','krnllib.h','lang.h','mtypes.h','PublicIDEFunctions.h','untshare.h']:
    shutil.copy(os.path.join(src_elib,f), os.path.join(dst_elib,f))

result = f'Converted: {converted} / elib copied'
print(result)
open(r'D:\chungbin\ycIDE-html\convert_result.txt','w').write(result)
