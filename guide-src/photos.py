import json, os, csv
from PIL import Image
R='/home/claude/guide'
man={ (r[0],int(r[1])):r[2] for r in csv.reader(open(R+'/raw/manifest.tsv'),delimiter='\t')}
# key: [(idx, caption, credit)]  first = hero
SEL={
 'hotel':[(3,'오늘의 골든 튤립(옛 신아반점) 외관','Suicasmo · CC0'),(10,'호텔 맞은편 상하이 우정총국 빌딩 야경','Siyuwj · CC BY-SA 4.0')],
 'siji':[('duck',3,'테이블 옆에서 베이징덕을 써는 모습','City Foodsters · CC BY 2.0')],
 'yuyuanEve':[(0,'구곡교 위의 호심정 찻집, 뒤로 상하이타워','Fredlyfish4 · CC BY-SA 4.0'),(9,'성황묘 마당의 청동 향로','xiquinhosilva · CC BY 2.0')],
 'bund':[(4,'밤의 와이탄','Lloyd Tudor · CC BY-SA 4.0'),(9,'12호 옛 HSBC 빌딩','钉钉 · CC BY-SA 4.0'),(22,'조계 시절 HSBC 사자 앞 사람들(옛 사진)','작자 미상 · Public domain'),(11,'13호 세관 시계탑','David Stanley · CC BY 2.0'),(16,'20호 화평반점의 초록 피라미드 지붕','Ermell · CC BY-SA 4.0'),(28,'외백도교와 뒤편 브로드웨이 맨션','kallerna · CC BY-SA 4.0'),(5,'1988년의 와이탄','Jan Kranendonk · CC0')],
 'nanxiang':[(4,'숟가락 위의 샤오롱바오','Robigasp · CC BY-SA 4.0')],
 'yugarden':[(3,'예원 연못과 누각','Ray in Manila · CC BY 2.0'),(2,'예원의 가산(돌산)','Rose Abrams · CC BY 4.0'),(5,'용 담장의 용 머리','Mr. Tickle · CC BY 2.5'),(4,'옥영롱','Gisling · CC BY-SA 3.0'),(16,'삼수당 현판','King of Hearts · CC BY-SA 4.0'),(13,'공작 무늬 창(漏窗)','pfctdayelise · CC BY-SA 2.5')],
 'newworld':[(0,'포르투갈식 에그타르트(파스텔 드 나타)','Dietmar Rabich · CC BY-SA 4.0'),(7,'옛 경마장 자리, 인민광장','King of Hearts · CC BY-SA 4.0')],
 'xizha':[(10,'밤의 우전 물길','Nico le terrible · CC0'),(5,'우전 서책의 돌다리와 나룻배','Gerbil · CC BY-SA 3.0'),(3,'서책 운하의 가마우지 낚시 배','Gerbil · CC BY-SA 3.0'),(16,'수각이 늘어선 우전 운하','韩笃一 · CC BY-SA 3.0')],
 'jingan':[(0,'빌딩 숲 속 정안사 금빛 지붕','kallerna · CC BY-SA 4.0'),(2,'정안사 대웅보전과 마당 향로','kallerna · CC BY-SA 4.0')],
 'roastery':[(1,'로스터리의 구리 원두통과 로스터','Codas · CC BY-SA 4.0'),(0,'육각형 나무 천장과 긴 커피 바','Codas · CC BY-SA 4.0')],
 'skewer':[(3,'숯불 위의 양꼬치','N509FZ · CC BY-SA 4.0')],
 'nanjing':[(2,'밤의 난징둥루 보행가','Hermann Luyken · CC0'),(5,'보행가의 관광 꼬마 열차','HeroicLife · CC BY 2.0')],
 'lujiazui':[(2,'와이탄에서 본 루자쭈이','Zhang Zhang · CC BY-SA 3.0'),(7,'동방명주','Ermell · CC BY-SA 4.0'),(12,'진마오 빌딩','Ermell · CC BY-SA 4.0'),(0,'2007년 공사 중인 환추금융센터(오른쪽)와 진마오','Reinhold Möller · CC BY-SA 4.0'),(3,'루자쭈이 야경','Larry Qian · CC0')],
 'shtower':[(2,'상하이타워와 진마오','Stefan Fussan · CC BY-SA 3.0'),(5,'118층에서 내려다본 황푸강과 와이탄','Cotopaxi5897 · CC BY-SA 4.0'),(11,'125층 댐퍼 ‘상하이의 눈’','MasaneMiyaPA · CC BY-SA 4.0')],
 'hotpot':[(2,'부위별로 썬 차오산식 소고기','Clarayyt · CC BY-SA 4.0')],
 'binjiang':[('binjiang',2,'푸둥에서 바라본 밤의 와이탄','Ctny · CC BY-SA 3.0')],
}
os.makedirs(R+'/dist/img',exist_ok=True)
out={}
for k,lst in SEL.items():
  out[k]=[]
  for j,t in enumerate(lst):
    if len(t)==4: topic,idx,cap,cr=t
    else: topic,(idx,cap,cr)=k,t
    src=man[(topic,idx)]
    im=Image.open(src).convert('RGB')
    fn=f'img/{k}-{j}.jpg'
    im.save(R+'/dist/'+fn,quality=80,optimize=True,progressive=True)
    out[k].append({'src':fn,'cap':cap,'credit':cr+' · Wikimedia Commons'})
json.dump(out,open(R+'/src/photos.json','w'),ensure_ascii=False,indent=1)
print(sum(len(v) for v in out.values()),'photos', sum(os.path.getsize(R+'/dist/img/'+f) for f in os.listdir(R+'/dist/img'))//1024,'KB')
