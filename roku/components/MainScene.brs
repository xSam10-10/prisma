' Tela principal do PRISMA no Roku.
' Níveis: "menu" (Ao vivo, Filmes, Séries, Trocar lista) › "cats" (categorias)
' › "items" (canais, filmes, séries) › "episodes" (episódios da série) › vídeo.

sub init()
    m.menu = m.top.findNode("menu")
    m.cats = m.top.findNode("cats")
    m.items = m.top.findNode("items")
    m.art = m.top.findNode("art")
    m.video = m.top.findNode("video")
    m.crumb = m.top.findNode("crumb")
    m.status = m.top.findNode("status")

    m.section = ""
    m.catList = []
    m.itemList = []
    m.episodes = []
    m.level = "menu"

    m.menu.content = listOf(["Ao vivo", "Filmes", "Séries", "Trocar lista"])
    m.menu.observeField("itemSelected", "onMenu")
    m.cats.observeField("itemSelected", "onCat")
    m.items.observeField("itemSelected", "onItem")
    m.items.observeField("itemFocused", "onItemFocus")
    m.video.observeField("state", "onVideoState")

    reg = CreateObject("roRegistrySection", "prisma")
    m.server = reg.Read("server")
    m.user = reg.Read("user")
    m.pass = reg.Read("pass")
    if m.server = "" or m.user = "" or m.pass = ""
        askLogin(0)
    else
        m.menu.setFocus(true)
        say("Lista: " + m.server)
    end if
end sub

' ------------------------------------------------------------ Ajudantes

function listOf(names as object) as object
    c = CreateObject("roSGNode", "ContentNode")
    for each n in names
        it = c.CreateChild("ContentNode")
        it.title = n
    end for
    return c
end function

sub say(t as string)
    m.status.text = t
end sub

function esc(s as string) as string
    t = CreateObject("roUrlTransfer")
    return t.Escape(s)
end function

function api(action as string, extra as string) as string
    u = m.server + "/player_api.php?username=" + esc(m.user) + "&password=" + esc(m.pass)
    if action <> "" then u = u + "&action=" + action
    return u + extra
end function

sub load(url as string, kind as string)
    say("Carregando…")
    m.task = CreateObject("roSGNode", "XtreamTask")
    m.task.url = url
    m.task.kind = kind
    m.task.observeField("result", "onLoaded")
    m.task.control = "RUN"
end sub

function sv(v as dynamic) as string
    if v = invalid then return ""
    if type(v) = "roString" or type(v) = "String" then return v
    if type(v) = "roInt" or type(v) = "Integer" or type(v) = "roInteger" or type(v) = "LongInteger" then return v.ToStr()
    if type(v) = "roFloat" or type(v) = "Float" or type(v) = "Double" or type(v) = "roDouble" then return Int(v).ToStr()
    return ""
end function

' ------------------------------------------------------------ Login (teclado do Roku)

sub askLogin(stepNum as integer)
    m.loginStep = stepNum
    d = CreateObject("roSGNode", "StandardKeyboardDialog")
    if stepNum = 0
        d.title = "Servidor da lista (Xtream)"
        d.message = ["Ex.: http://servidor.com:8080 — o mesmo do Smarters/XCIPTV."]
        d.text = m.server
    else if stepNum = 1
        d.title = "Usuário"
        d.message = ["O usuário da sua assinatura."]
        d.text = m.user
    else
        d.title = "Senha"
        d.message = ["Fica guardada só neste Roku."]
        d.text = ""
        d.textEditBox.secureMode = true
    end if
    d.buttons = ["Continuar", "Cancelar"]
    d.observeField("buttonSelected", "onLoginButton")
    m.top.dialog = d
end sub

sub onLoginButton()
    d = m.top.dialog
    if d = invalid then return
    if d.buttonSelected = 1
        d.close = true
        if m.server = "" then askLogin(0) else m.menu.setFocus(true)
        return
    end if
    v = d.text.Trim()
    d.close = true
    if m.loginStep = 0
        if v = "" then
            askLogin(0)
            return
        end if
        if LCase(Left(v, 4)) <> "http" then v = "http://" + v
        while Right(v, 1) = "/"
            v = Left(v, Len(v) - 1)
        end while
        m.server = v
        askLogin(1)
    else if m.loginStep = 1
        m.user = v
        askLogin(2)
    else
        m.pass = v
        load(api("", ""), "login")
    end if
end sub

sub showError(t as string)
    d = CreateObject("roSGNode", "StandardMessageDialog")
    d.title = "PRISMA"
    d.message = [t]
    d.buttons = ["OK"]
    d.observeField("buttonSelected", "closeDialog")
    m.top.dialog = d
end sub

sub closeDialog()
    if m.top.dialog <> invalid then m.top.dialog.close = true
end sub

' ------------------------------------------------------------ Respostas da API

sub onLoaded()
    r = m.task.result
    if r = invalid then return
    if not r.ok
        say("")
        showError(r.error)
        if r.kind = "login" then askLogin(0)
        return
    end if
    data = r.data
    if r.kind = "login"
        ui = data.user_info
        if ui = invalid or sv(ui.auth) <> "1"
            showError("Usuário ou senha não conferem.")
            askLogin(1)
            return
        end if
        reg = CreateObject("roRegistrySection", "prisma")
        reg.Write("server", m.server)
        reg.Write("user", m.user)
        reg.Write("pass", m.pass)
        reg.Flush()
        say("Conectado: " + m.server)
        m.menu.setFocus(true)
    else if r.kind = "cats"
        m.catList = []
        names = []
        if type(data) = "roArray"
            for each c in data
                m.catList.Push(c)
                names.Push(sv(c.category_name))
            end for
        end if
        m.cats.content = listOf(names)
        m.items.content = listOf([])
        m.art.uri = ""
        say(names.Count().ToStr() + " categorias")
        m.level = "cats"
        m.cats.setFocus(true)
    else if r.kind = "items"
        m.itemList = []
        names = []
        if type(data) = "roArray"
            for each it in data
                m.itemList.Push(it)
                n = sv(it.name)
                if m.section = "live" and sv(it.num) <> "" then n = sv(it.num) + "  " + n
                names.Push(n)
            end for
        end if
        m.items.content = listOf(names)
        say(names.Count().ToStr() + " títulos · OK para assistir · Voltar volta")
        m.level = "items"
        m.items.setFocus(true)
    else if r.kind = "series"
        m.episodes = []
        names = []
        eps = data.episodes
        if eps <> invalid
            seasons = eps.Keys()
            seasons.Sort()
            for each s in seasons
                for each e in eps[s]
                    m.episodes.Push(e)
                    names.Push("T" + s + " E" + sv(e.episode_num) + " · " + sv(e.title))
                end for
            end for
        end if
        m.items.content = listOf(names)
        say(names.Count().ToStr() + " episódios")
        m.level = "episodes"
        m.items.setFocus(true)
    end if
end sub

' ------------------------------------------------------------ Seleções

sub onMenu()
    i = m.menu.itemSelected
    if i = 0
        m.section = "live"
        m.crumb.text = "Ao vivo"
        load(api("get_live_categories", ""), "cats")
    else if i = 1
        m.section = "vod"
        m.crumb.text = "Filmes"
        load(api("get_vod_categories", ""), "cats")
    else if i = 2
        m.section = "series"
        m.crumb.text = "Séries"
        load(api("get_series_categories", ""), "cats")
    else
        reg = CreateObject("roRegistrySection", "prisma")
        reg.Delete("pass")
        reg.Flush()
        askLogin(0)
    end if
end sub

sub onCat()
    c = m.catList[m.cats.itemSelected]
    if c = invalid then return
    id = sv(c.category_id)
    m.crumb.text = m.crumb.text + "  ›  " + sv(c.category_name)
    if m.section = "live"
        load(api("get_live_streams", "&category_id=" + id), "items")
    else if m.section = "vod"
        load(api("get_vod_streams", "&category_id=" + id), "items")
    else
        load(api("get_series", "&category_id=" + id), "items")
    end if
end sub

sub onItemFocus()
    if m.level = "episodes" then return
    it = m.itemList[m.items.itemFocused]
    if it = invalid then return
    icon = sv(it.stream_icon)
    if icon = "" then icon = sv(it.cover)
    m.art.uri = icon
end sub

sub onItem()
    if m.level = "episodes"
        e = m.episodes[m.items.itemSelected]
        if e = invalid then return
        ext = sv(e.container_extension)
        if ext = "" then ext = "mp4"
        play(m.server + "/series/" + esc(m.user) + "/" + esc(m.pass) + "/" + sv(e.id) + "." + ext, sv(e.title), ext)
        return
    end if
    it = m.itemList[m.items.itemSelected]
    if it = invalid then return
    if m.section = "live"
        play(m.server + "/live/" + esc(m.user) + "/" + esc(m.pass) + "/" + sv(it.stream_id) + ".m3u8", sv(it.name), "hls")
    else if m.section = "vod"
        ext = sv(it.container_extension)
        if ext = "" then ext = "mp4"
        play(m.server + "/movie/" + esc(m.user) + "/" + esc(m.pass) + "/" + sv(it.stream_id) + "." + ext, sv(it.name), ext)
    else
        m.crumb.text = m.crumb.text + "  ›  " + sv(it.name)
        load(api("get_series_info", "&series_id=" + sv(it.series_id)), "series")
    end if
end sub

' ------------------------------------------------------------ Player

sub play(url as string, title as string, fmt as string)
    c = CreateObject("roSGNode", "ContentNode")
    c.url = url
    c.title = title
    if fmt = "hls" or fmt = "m3u8"
        c.streamFormat = "hls"
    else if fmt = "mkv"
        c.streamFormat = "mkv"
    else if fmt = "ts"
        c.streamFormat = "ts"
    else
        c.streamFormat = "mp4"
    end if
    m.video.content = c
    m.video.visible = true
    m.video.control = "play"
    m.video.setFocus(true)
end sub

sub stopVideo()
    m.video.control = "stop"
    m.video.visible = false
    m.items.setFocus(true)
end sub

sub onVideoState()
    st = m.video.state
    if st = "error"
        msg = m.video.errorMsg
        stopVideo()
        showError("Não deu para tocar este vídeo. " + msg)
    else if st = "finished"
        stopVideo()
    end if
end sub

' ------------------------------------------------------------ Controle remoto

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if m.video.visible
        if key = "back"
            stopVideo()
            return true
        end if
        return false
    end if
    if key = "back"
        if m.level = "episodes"
            m.level = "items"
            load(api("get_series", "&category_id=" + sv(m.catList[m.cats.itemFocused].category_id)), "items")
            return true
        else if m.level = "items"
            m.level = "cats"
            m.cats.setFocus(true)
            return true
        else if m.level = "cats"
            m.level = "menu"
            m.crumb.text = ""
            m.menu.setFocus(true)
            return true
        end if
        return false
    end if
    if key = "left"
        if m.items.hasFocus()
            m.level = "cats"
            m.cats.setFocus(true)
            return true
        else if m.cats.hasFocus()
            m.level = "menu"
            m.menu.setFocus(true)
            return true
        end if
    else if key = "right"
        if m.menu.hasFocus() and m.cats.content <> invalid and m.cats.content.getChildCount() > 0
            m.level = "cats"
            m.cats.setFocus(true)
            return true
        else if m.cats.hasFocus() and m.items.content <> invalid and m.items.content.getChildCount() > 0
            m.level = "items"
            m.items.setFocus(true)
            return true
        end if
    end if
    return false
end function
