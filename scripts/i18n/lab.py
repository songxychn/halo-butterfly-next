"""Apply the i18n acceptance profile to an already owned seeded comparison lab."""
import sys,json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab
c=lab.Client()
for collection,name,language in [('posts','preview-1','ja'),('singlepages','about-preview','ko')]:
 path='/apis/content.halo.run/v1alpha1/'+collection+'/'+name
 obj=c.api(path);obj['metadata'].setdefault('annotations',{})['language']=language;c.api(path,'PUT',obj)
path=f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
config=c.api(path);config['share']={'use':'native'};c.api(path,'PUT',config)
print('Configured post ja and singlepage ko content language; native share enabled')
