' PRISMA para Roku (0.30.0) — versão básica.
' Entra com a lista Xtream (servidor, usuário e senha digitados no próprio Roku
' e guardados só nele), mostra canais ao vivo por categoria, filmes e séries,
' e toca no player do Roku. Instalação: modo desenvolvedor do Roku (roku/LEIAME.md).

sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end while
end sub
