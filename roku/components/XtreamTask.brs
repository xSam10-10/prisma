sub init()
    m.top.functionName = "fetch"
end sub

' Baixa o endereço e devolve { kind, ok, data (JSON já lido) ou error }.
sub fetch()
    t = CreateObject("roUrlTransfer")
    t.SetUrl(m.top.url)
    t.SetCertificatesFile("common:/certs/ca-bundle.crt")
    t.InitClientCertificates()
    t.AddHeader("User-Agent", "VLC/3.0.20 LibVLC/3.0.20")
    t.EnableEncodings(true)
    t.RetainBodyOnError(true)
    port = CreateObject("roMessagePort")
    t.SetMessagePort(port)
    out = { kind: m.top.kind, ok: false }
    if t.AsyncGetToString()
        msg = wait(30000, port)
        if type(msg) = "roUrlEvent"
            code = msg.GetResponseCode()
            body = msg.GetString()
            if code >= 200 and code < 300
                data = ParseJson(body)
                if data <> invalid
                    out.ok = true
                    out.data = data
                else
                    out.error = "Resposta inesperada do servidor."
                end if
            else if code = 401 or code = 403
                out.error = "O servidor recusou o acesso. Confira usuário e senha."
            else
                out.error = "O servidor respondeu com erro " + code.ToStr() + "."
            end if
        else
            t.AsyncCancel()
            out.error = "O servidor demorou demais para responder."
        end if
    else
        out.error = "Não foi possível conectar ao servidor."
    end if
    m.top.result = out
end sub
