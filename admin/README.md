# 4<8=8AB@0B82=K9 1>B Greenlight Casino

>;=>F5==0O A8AB5<0 04<8=8AB@8@>20=8O :078=> G5@57 Telegram 1>B0 A @0AH8@5==K<8 2>7<>6=>ABO<8 C?@02;5=8O.

## =� A=>2=K5 2>7<>6=>AB8

### =� $8=0=A>2>5 C?@02;5=85
- **"5:CI55 A>AB>O=85 :078=>**: 0;0=A, ?@81K;L, @0AE>4K, AB0B8AB8:0 ?>;L7>20B5;59
- **$8=0=A>2K5 >BG5BK**: 0 45=L, =545;N, <5AOF A 45B0;L=>9 0=0;8B8:>9
- **!B0B8AB8:0 ?> 83@0<**: 5B0;L=0O >BG5B=>ABL ?> :064>9 83@5 (Coin, Crash, Slots, Mines)
- **>=B@>;L ?@81K;L=>AB8**: ROI, House Edge, :><8AA88

### =e #?@02;5=85 ?>;L7>20B5;O<8
- **>8A: ?>;L7>20B5;59**: > Telegram ID, username, 8<5=8
- **@>D8;8 ?>;L7>20B5;59**: >;=0O 8=D>@<0F8O > 10;0=A5, 83@0E, B@0=70:F8OE
- **;>:8@>2:0/@071;>:8@>2:0**: 3=>25==>5 C?@02;5=85 4>ABC?><
- **>@@5:B8@>2:0 10;0=A0**: 0G8A;5=8O 8 A?8A0=8O A C:070=85< ?@8G8=K
- **!B0B8AB8:0 ?>;L7>20B5;59**: :B82=>ABL, @538AB@0F88, 45?>78BK

### <� #?@02;5=85 B@0=70:F8O<8
- **4>1@5=85 2K2>4>2**: @>A<>B@ 8 >1@01>B:0 70O2>: =0 2K2>4 A@54AB2
- **AB>@8O B@0=70:F89**: >;=0O 8AB>@8O A D8;LB@0F859 8 =02830F859
- **2B><0B8G5A:0O ?@>25@:0**: KO2;5=85 ?>4>7@8B5;L=KE >?5@0F89
- **!B0B8AB8:0 2K2>4>2**: =0;8B8:0 ?> AB0BCA0<, AC<<0<, ?5@8>40<
- **=D>@<0F8O > 45?>78B0E**: !B0B8AB8:0 ?>?>;=5=89 AG5B>2

### <� #?@02;5=85 :>MDD8F85=B0<8
- **;>10;L=K5 =0AB@>9:8**: #=825@A0;L=K5 <>48D8:0B>@K 4;O 2A5E ?>;L7>20B5;59
- **=48284C0;L=K5 =0AB@>9:8**: 5@A>=0;L=K5 :>MDD8F85=BK 4;O :>=:@5B=KE 83@>:>2
- **>48D8:0B>@K 83@**:
  - >� **Coin Flip**: 7<5=5=85 H0=A0 2K83@KH0
  - <� **Slots**: >48D8:0F8O RTP (Return to Player)
  - =� **Mines**: 0AB@>9:0 :>;8G5AB20 <8=
  - =� **Crash**: >=B@>;L @0==53> :@0H0
- **!B0B8AB8:0 <>48D8:0B>@>2**: =0;87 8A?>;L7>20=8O 8 MDD5:B82=>AB8

### =. #?@02;5=85 A>1KB8O<8
- **!>740=85 A>1KB89**: KAB@>5 A>740=85 A =0AB@>9:>9 :0B53>@89 8 2@5<5=8
- **025@H5=85 A>1KB89**: #AB0=>2:0 ?>1548B5;59 8 @0AG5B 2K?;0B
- **!?8A>: A>1KB89**: @>A<>B@ 2A5E A>1KB89 A D8;LB@0F859
- **!B0B8AB8:0 A>1KB89**: =0;8B8:0 ?> AB02:0< 8 2K?;0B0<

## =� ><0=4K 1>B0

### A=>2=K5 :><0=4K
- `/start` - 0?CA: 1>B0 8 3;02=>5 <5=N
- `/finances` - $8=0=A>20O ?0=5;L
- `/users` - #?@02;5=85 ?>;L7>20B5;O<8
- `/transactions` - #?@02;5=85 B@0=70:F8O<8
- `/coefficients` - 0AB@>9:0 :>MDD8F85=B>2
- `/events` - #?@02;5=85 A>1KB8O<8

### ><0=4K 4;O A>1KB89
- `/create_event` - KAB@>5 A>740=85 A>1KB8O
- `/finish_event` - 025@H5=85 A>1KB8O
- `/events_list` - !?8A>: 2A5E A>1KB89

## =' 0AB@>9:0

### 5@5<5==K5 >:@C65=8O
```env
ADMIN_BOT_TOKEN=your_telegram_bot_token
ADMIN_API_TOKEN=your_backend_api_token
API_URL=https://your-api-domain.com/api
ADMIN_IDS=123456789,987654321
WEBHOOK_DOMAIN=https://your-domain.com
```

### 0?CA:
```bash
#  07@01>B:0
npm run dev

# @>40:H=
npm start
```

## =� !B@C:BC@0 ?@>5:B0

```
admin/
   src/
      commands/
         index.js              # A=>2=>9 D09; :><0=4
         users.command.js      # ><0=4K C?@02;5=8O ?>;L7>20B5;O<8
         transactions.command.js # ><0=4K C?@02;5=8O B@0=70:F8O<8
         coefficients.command.js # ><0=4K C?@02;5=8O :>MDD8F85=B0<8
         events.command.js     # ><0=4K C?@02;5=8O A>1KB8O<8
         stats.command.js      # ><0=4K AB0B8AB8:8
      handlers/
      middleware/
      services/
   index.js                      # ">G:0 2E>40
   package.json
```

## = 57>?0A=>ABL

- **2B>@870F8O**: ">;L:> 04<8=8AB@0B>@K 87 A?8A:0 ADMIN_IDS 8<5NB 4>ABC?
- **API B>:5=K**: 0I8I5==K5 70?@>AK : 1M:5=4C
- **0;840F8O**: @>25@:0 2A5E 2E>4OI8E 40==KE
- **>38@>20=85**: 5B0;L=K5 ;>38 2A5E 459AB289 04<8=8AB@0B>@>2

## =� $C=:F88 >BG5B=>AB8

### $8=0=A>2K5 >BG5BK
- 1I89 10;0=A 8 4>ABC?=K5 A@54AB20
- @81K;L 8 C1KB:8 ?> ?5@8>40<
- !B0B8AB8:0 ?> 83@0<
- =0;87 House Edge
- ><8AA88 8 A1>@K

### >;L7>20B5;LA:0O 0=0;8B8:0
-  538AB@0F88 ?> ?5@8>40<
- :B82=>ABL ?>;L7>20B5;59
- !@54=85 10;0=AK
- ">? 83@>:8 ?> >1J5<C AB02>:

### "@0=70:F8>==0O >BG5B=>ABL
- !B0B8AB8:0 2K2>4>2 8 45?>78B>2
- =0;87 >B:;>=5=89
- @5<O >1@01>B:8 70O2>:
- >4>7@8B5;L=K5 >?5@0F88

## <� #?@02;5=85 83@0<8

### >48D8:0B>@K :>MDD8F85=B>2
>72>;ONB B>=:> =0AB@0820BL A;>6=>ABL 83@:

- **>;>68B5;L=K5 7=0G5=8O**: #25;8G820NB A;>6=>ABL 4;O 83@>:0
- **B@8F0B5;L=K5 7=0G5=8O**: #<5=LH0NB A;>6=>ABL
- **C;52K5 7=0G5=8O**: !B0=40@B=K5 =0AB@>9:8

### 3@0=8G5=8O <>48D8:0B>@>2
- **Coin Flip**: >B -47.5% 4> +52.5%
- **Slots**: >B -30% 4> +20%
- **Mines**: >B -20% 4> +30%
- **Crash**: >B -20% 4> +50%

## =� >=8B>@8=3

>B ?@54>AB02;O5B 45B0;L=CN 8=D>@<0F8N >:
- "5:CI5< A>AB>O=88 2A5E A8AB5<
- :B82=KE ?>;L7>20B5;OE
- 1@010BK205<KE B@0=70:F8OE
- 0AB@>9:0E :>MDD8F85=B>2
- !B0B8AB8:5 A>1KB89

## > 2B><0B870F8O

- **2B><0B8G5A:>5 >4>1@5=85**: 5;:85 2K2>4K (4> 300 USDT) >1@010BK20NBAO 02B><0B8G5A:8
- **#254><;5=8O**: 3=>25==K5 C254><;5=8O > 206=KE A>1KB8OE
- **;0=8@>2I8: >BG5B>2**: 2B><0B8G5A:0O 35=5@0F8O 5654=52=KE >BG5B>2
- **>=8B>@8=3 0=><0;89**: 2B><0B8G5A:>5 2KO2;5=85 ?>4>7@8B5;L=>9 0:B82=>AB8

## =� >445@6:0

;O ?>;CG5=8O ?><>I8 ?> 8A?>;L7>20=8N 04<8=-1>B0:
1. @>25@LB5 4>:C<5=B0F8N API
2. #1548B5AL 2 :>@@5:B=>AB8 ?5@5<5==KE >:@C65=8O
3. @>25@LB5 ?@020 4>ABC?0 04<8=8AB@0B>@0

## = 1=>2;5=8O

>B ?>445@68205B 3>@OG85 >1=>2;5=8O 157 ?5@570?CA:0 A5@25@0. >2K5 DC=:F88 4>102;ONBAO <>4C;L=> 157 2;8O=8O =0 ACI5AB2CNI89 DC=:F8>=0;.