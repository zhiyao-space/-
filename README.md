<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Pocket Phone</title>

<link rel="stylesheet" href="style.css">

</head>

<body>


<div class="phone">

    <div class="status">
        <span id="time">12:00</span>
        <span>◉ 100%</span>
    </div>


    <div class="screen">

        <div class="wallpaper">


            <div class="app-grid">


                <div class="app" onclick="openApp('chat')">
                    💬
                    <p>聊天</p>
                </div>


                <div class="app" onclick="openApp('world')">
                    🌏
                    <p>世界观</p>
                </div>


                <div class="app" onclick="openApp('wechat')">
                    🟢
                    <p>微信</p>
                </div>


                <div class="app" onclick="openApp('api')">
                    🧠
                    <p>API脑端</p>
                </div>


                <div class="app" onclick="openApp('theme')">
                    🎀
                    <p>美化</p>
                </div>


                <div class="app" onclick="openApp('forum')">
                    🖤
                    <p>论坛</p>
                </div>


                <div class="app" onclick="openApp('social')">
                    🌐
                    <p>社交</p>
                </div>


                <div class="app" onclick="openApp('secret')">
                    🕶
                    <p>暗域</p>
                </div>


            </div>


        </div>


        <div id="window" class="window">

            <div class="top">
                <button onclick="closeApp()">←</button>
                <span id="title"></span>
            </div>

            <div id="content"></div>

        </div>



    </div>


</div>



<script src="app.js"></script>

</body>
</html>
*{
    box-sizing:border-box;
}


body{

    margin:0;
    height:100vh;

    display:flex;
    justify-content:center;
    align-items:center;

    background:#111;

    font-family:
    "PingFang SC",
    Arial;

}



.phone{

    width:360px;
    height:720px;

    background:#000;

    border-radius:45px;

    padding:12px;

    box-shadow:
    0 0 50px #000;

}



.screen{

    width:100%;
    height:100%;

    overflow:hidden;

    border-radius:35px;

    background:white;

    position:relative;

}



.status{

    position:absolute;

    top:18px;

    left:35px;

    right:35px;

    z-index:10;

    display:flex;

    justify-content:space-between;

    color:white;

    font-size:13px;

}



.wallpaper{

    height:100%;

    background:

    linear-gradient(
    135deg,
    #ffffff,
    #dddddd
    );

}



.app-grid{

    padding:80px 25px;

    display:grid;

    grid-template-columns:
    repeat(4,1fr);

    gap:25px;

}



.app{

    text-align:center;

    font-size:30px;

    cursor:pointer;

}



.app p{

    font-size:12px;

    margin-top:5px;

}



.window{

    position:absolute;

    top:0;

    left:0;

    width:100%;

    height:100%;

    background:white;

    display:none;

}



.top{

    height:60px;

    display:flex;

    align-items:center;

    gap:20px;

    padding:20px;

    border-bottom:
    1px solid #ddd;

}



button{

    border:none;

    background:#eee;

    border-radius:50%;

}



#content{

    padding:20px;

}
const apps={


chat:{
title:"AI聊天",
content:
`
<h2>AI助手</h2>

<input id="msg"
placeholder="输入消息">

<button onclick="sendAI()">
发送
</button>

<div id="reply"></div>

`
},



world:{
title:"世界观设置",
content:
`
<h2>我的世界</h2>

<p>
创建你的AI世界设定
</p>

<textarea placeholder="输入世界观"></textarea>

`
},



wechat:{
title:"微信模拟",
content:
`
<h2>微信</h2>

<p>
联系人：
AI朋友、小白、小黑
</p>

`
},



api:{
title:"API脑端",
content:
`
<h2>AI核心</h2>

<p>
模型状态：
未连接
</p>

<button>
连接API
</button>

`
},



theme:{
title:"美化组件",
content:
`
<h2>主题设置</h2>

<p>
黑白模式 ✔
</p>

`
},



forum:{
title:"论坛",
content:
`
<h2>AI社区</h2>

<p>
暂无帖子
</p>

`
},



social:{
title:"社交中心",
content:
`
<h2>
微博 / 小红书 / X
</h2>

`
},



secret:{
title:"暗域",
content:
`
<h2>
虚拟秘密区域
</h2>

<p>
世界观剧情入口
</p>

`
}


};



function openApp(name){

let app=apps[name];


document.getElementById("window")
.style.display="block";


document.getElementById("title")
.innerHTML=app.title;


document.getElementById("content")
.innerHTML=app.content;


}



function closeApp(){

document.getElementById("window")
.style.display="none";

}



function sendAI(){

let text=
document.getElementById("msg").value;


document.getElementById("reply")
.innerHTML=
`
<p>
AI:
正在等待API接入...
</p>
`;

}




function updateTime(){

let d=new Date();

document.getElementById("time")
.innerHTML=
d.toLocaleTimeString()
.slice(0,5);

}


setInterval(updateTime,1000);

updateTime();
