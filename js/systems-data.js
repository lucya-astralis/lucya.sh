// Hardware snapshots and rack inventory. Template whitespace preserves ASCII art.
export const neofetchData = [
    {
      id: 'lynx',
      tab: 'lynx',
      group: 'server',
      title: 'lynx.lucya.intra // homelab core hypervisor',
      width: 800,
      live: 'lynx',        // host name in status.json
      memTotal: 15.53,     // GiB — fallback for feeds that only know the percentage
      content: `<span style="color: #e7e7e7;">         .://:'              '://:.<span/>             <span style="color: #E57000;">root<span/><span style="color: #e7e7e7;">@<span/><span style="color: #E57000;">lynx</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'<span/>           <span style="color: #E57000;">---------<span/>
<span style="color: #e7e7e7;">        'sMMMMMMMd:      :mMMMMMMMs'<span/>            <span style="color: #e7e7e7;">OS: Proxmox VE 9.x.x x86_64<span/>
<span style="color: #E57000;">'-/+oo+/:<span/><span style="color: #e7e7e7;">'.yMMMMMMMh-  -hMMMMMMMy.'<span/><span style="color: #E57000;">:/+oo+/-'    <span/><span style="color: #e7e7e7;">Host: Macmini6,2 (1.0)<span/>
<span style="color: #E57000;">':oooooooo/<span/><span style="color: #e7e7e7;">'-hMMMMMMMyyMMMMMMMh-'<span/><span style="color: #E57000;">/oooooooo:'    <span/><span style="color: #e7e7e7;">Kernel: Linux 6.17.4-2-pve<span/>
<span style="color: #E57000;">  '/oooooooo:<span/><span style="color: #e7e7e7;">':mMMMMMMMMMMMMm:'<span/><span style="color: #E57000;">:oooooooo/'      <span/><span style="color: #e7e7e7;">Uptime: <span class="nlive" data-live="uptime">23 days, 22 hours, 54 mins</span><span/>
<span style="color: #E57000;">    ./ooooooo+-<span/><span style="color: #e7e7e7;"> +NMMMMMMMMN+ <span/><span style="color: #E57000;">-+ooooooo/.        <span/><span style="color: #e7e7e7;">Packages: 738 (dpkg)<span/>
<span style="color: #E57000;">      .+ooooooo+-<span/><span style="color: #e7e7e7;">'oNMMMMNo'<span/><span style="color: #E57000;">-+ooooooo+.          <span/><span style="color: #e7e7e7;">Shell: bash 5.2.37<span/>
<span style="color: #E57000;">        -+ooooooo/.<span/><span style="color: #e7e7e7;">'sMMs'<span/><span style="color: #E57000;">./ooooooo+-            <span/><span style="color: #e7e7e7;">Terminal: termproxy<span/>
<span style="color: #E57000;">          :oooooooo/<span/><span style="color: #e7e7e7;">'..'<span/><span style="color: #E57000;">/oooooooo:              <span/><span style="color: #e7e7e7;">CPU: Intel(R) Core(TM) i7-3615QM (8) @ 3.30 GHz <span class="nlive" data-live="temp"></span><span/>
<span style="color: #E57000;">          :oooooooo/'<span/><span style="color: #e7e7e7;">..<span/><span style="color: #E57000;">'/oooooooo:              <span/><span style="color: #e7e7e7;">CPU Usage: <span class="nlive" data-live="cpu">—</span><span/>
<span style="color: #E57000;">        -+ooooooo/.'<span/><span style="color: #e7e7e7;">sMMs<span/><span style="color: #E57000;">'./ooooooo+-            <span/><span style="color: #e7e7e7;">GPU: Intel 3rd Gen Core processor Graphics Controller<span/>
<span style="color: #E57000;">      .+ooooooo+-'<span/><span style="color: #e7e7e7;">oNMMMMNo<span/><span style="color: #E57000;">'-+ooooooo+.          <span/><span style="color: #e7e7e7;">Memory: <span class="nlive" data-live="mem-used">12.66 GiB</span> / <span class="nlive" data-live="mem-total">15.53 GiB</span> (<span/><span class="nlive" data-live="mem-pct" style="color: #da0a0a;">82%<span/><span style="color: #e7e7e7;">)<span/>
<span style="color: #E57000;">    ./ooooooo+- <span/><span style="color: #e7e7e7;">+NMMMMMMMMN+ <span/><span style="color: #E57000;">-+ooooooo/.        <span/><span style="color: #e7e7e7;">Swap: 124.55 MiB / 8.00 GiB (<span/><span style="color: #06e236;">2%<span/><span style="color: #e7e7e7;">)<span/>
<span style="color: #E57000;">  '/oooooooo:'<span/><span style="color: #e7e7e7;">:mMMMMMMMMMMMMm:<span/><span style="color: #E57000;">':oooooooo/'      <span/><span style="color: #e7e7e7;">Disk (/): 21.41 GiB / 93.93 GiB (<span/><span style="color: #06e236;">23%<span/><span style="color: #e7e7e7;">) - ext4<span/>
<span style="color: #E57000;">':oooooooo/'<span/><span style="color: #e7e7e7;">-hMMMMMMMyyMMMMMMMh-<span/><span style="color: #E57000;">'/oooooooo:'    <span/><span style="color: #e7e7e7;">Local IP (vmbr0): 192.168.178.252/24<span/>
<span style="color: #E57000;">'-/+oo+/:'<span/><span style="color: #e7e7e7;">.yMMMMMMMh-  -hMMMMMMMy.<span/><span style="color: #E57000;">':/+oo+/-'    <span/><span style="color: #e7e7e7;">Locale: en_US.UTF-8<span/>
<span style="color: #e7e7e7;">        'sMMMMMMMm:      :dMMMMMMMs'<span/>            <span style="color: #e7e7e7;">Storage (data): <span class="nlive" data-live="disk-used">—</span> / <span class="nlive" data-live="disk-total">—</span> (</span><span class="nlive" data-live="disk-pct">—</span><span style="color: #e7e7e7;">)</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'<span/>           <span style="color: #e7e7e7;">Services: <span class="nlive" data-live="svc">—</span></span>
<span style="color: #e7e7e7;">         '://:'              '://:'<span/> `
    },
    {
      id: 'vega',
      tab: 'vega',
      group: 'server',
      title: 'vega.lucya.intra // synology nas',
      width: 780,
      live: 'vega',
      memTotal: 8.00,
      // DSM has no fastfetch, so this sheet is transcribed by hand from
      // Systemsteuerung > Info-Center (Allgemein / Speicher / Netzwerk).
      // Only what those pages actually show — the serial number and the MAC
      // stay off a public page. The logo is the DSM app icon in ASCII.
      content: `  <span style="color:#2074cf;">#############################</span>     <span style="color:#44a9fe;">lucya</span><span style="color:#8a8f98;">@</span><span style="color:#44a9fe;">vega</span>
 <span style="color:#2074cf;">###############################</span>    <span style="color:#8a8f98;">----------</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">OS:</span><span style="color:#e7e7e7;"> DSM 7.x.x-xxxx</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Host:</span><span style="color:#e7e7e7;"> Synology DS918+ (4-bay)</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Uptime:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="uptime">27 days, 13 hours, 47 mins</span></span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">CPU:</span><span style="color:#e7e7e7;"> Intel Celeron J3455 (4) @ 1.50 GHz</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">#######</span><span style="color:#2074cf;">####</span><span style="color:#ffffff;">#######</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">CPU Usage:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="cpu">—</span></span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">########</span><span style="color:#ffffff;">###</span><span style="color:#2074cf;">###</span><span style="color:#ffffff;">###</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Memory:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="mem-used">—</span> / <span class="nlive" data-live="mem-total">8.00 GiB</span> (<span class="nlive" data-live="mem-pct">—</span>)</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">######</span><span style="color:#2074cf;">###</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#</span><span style="color:#ffffff;">###</span><span style="color:#2074cf;">#</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Volume 1 (SSD RAID 1):</span><span style="color:#e7e7e7;"> 502.7 GB / 884.2 GB (56%)</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#########</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">#</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Volume 2 (HDD RAID 1):</span><span style="color:#e7e7e7;"> 1.7 TB / 3.5 TB (49%)</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">#######</span><span style="color:#2074cf;">###</span><span style="color:#ffffff;">########</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Drives:</span><span style="color:#e7e7e7;"> 2 x Samsung 870 EVO 1 TB - 34/35 °C</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Drives:</span><span style="color:#e7e7e7;"> 2 x WD Red WD40EFRX 4 TB - 41/40 °C</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Cache:</span><span style="color:#e7e7e7;"> HP SSD EX900 120 GB</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Thermal:</span><span style="color:#e7e7e7;"> system <span class="nlive" data-live="temp-c">—</span> · drives <span class="nlive" data-live="disk-temp">—</span></span>
 <span style="color:#2074cf;">###############################</span>    <span style="color:#44a9fe;">Fan:</span><span style="color:#e7e7e7;"> Quiet Mode · <span class="nlive" data-live="fans">—</span></span>
  <span style="color:#2074cf;">#############################</span>     <span style="color:#44a9fe;">USB:</span><span style="color:#e7e7e7;"> Transcend StoreJet (external)</span>
                                    <span style="color:#44a9fe;">Storage:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="disk-used">—</span> / <span class="nlive" data-live="disk-total">—</span> (<span class="nlive" data-live="disk-pct">—</span>)</span>
                                    <span style="color:#44a9fe;">Health:</span><span style="color:#e7e7e7;"> disks <span class="nlive" data-live="disks">—</span> · pools <span class="nlive" data-live="pools">—</span></span>
                                    <span style="color:#44a9fe;">Services:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="svc">—</span></span>
                                    <span style="color:#44a9fe;">Network (bond1):</span><span style="color:#e7e7e7;"> 2000 Mbit/s full duplex - MTU 1500</span>
                                    <span style="color:#44a9fe;">Local IP:</span><span style="color:#e7e7e7;"> 192.168.178.xxx/xx</span>
                                    <span style="color:#44a9fe;">DNS:</span><span style="color:#e7e7e7;"> 192.168.178.xxx</span>
                                    <span style="color:#44a9fe;">NTP:</span><span style="color:#e7e7e7;"> time.google.com</span>
                                    <span style="color:#44a9fe;">Timezone:</span><span style="color:#e7e7e7;"> Europe/Berlin (GMT+01:00)</span>
                                    <span style="color:#44a9fe;">Locale:</span><span style="color:#e7e7e7;"> de-DE</span>`
    },
    {
      id: 'chimera',
      tab: 'chimera',
      group: 'server',
      title: 'chimera.lucya.intra // homelab hypervisor',
      width: 850,
      live: 'chimera',
      memTotal: 62.69,
      content: `<span style="color: #e7e7e7;">         .://:'              '://:.</span>             <span style="color: #E57000;">root</span><span style="color: #e7e7e7;">@</span><span style="color: #E57000;">chimera</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'</span>           <span style="color: #E57000;">------------</span>
<span style="color: #e7e7e7;">        'sMMMMMMMd:      :mMMMMMMMs'</span>            <span style="color: #e7e7e7;">OS: Proxmox VE 9.2.4 x86_64</span>
<span style="color: #E57000;">'-/+oo+/:</span><span style="color: #e7e7e7;">'.yMMMMMMMh-  -hMMMMMMMy.'</span><span style="color: #E57000;">:/+oo+/-'    </span><span style="color: #e7e7e7;">Host: SYS-5018D-FN4T (0123456789)</span>
<span style="color: #E57000;">':oooooooo/</span><span style="color: #e7e7e7;">'-hMMMMMMMyyMMMMMMMh-'</span><span style="color: #E57000;">/oooooooo:'    </span><span style="color: #e7e7e7;">Kernel: Linux 7.0.14-5-pve</span>
<span style="color: #E57000;">  '/oooooooo:</span><span style="color: #e7e7e7;">':mMMMMMMMMMMMMm:'</span><span style="color: #E57000;">:oooooooo/'      </span><span style="color: #e7e7e7;">Uptime: <span class="nlive" data-live="uptime">17 hours, 29 mins</span></span>
<span style="color: #E57000;">    ./ooooooo+-</span><span style="color: #e7e7e7;"> +NMMMMMMMMN+ </span><span style="color: #E57000;">-+ooooooo/.        </span><span style="color: #e7e7e7;">Packages: 753 (dpkg)</span>
<span style="color: #E57000;">      .+ooooooo+-</span><span style="color: #e7e7e7;">'oNMMMMNo'</span><span style="color: #E57000;">-+ooooooo+.          </span><span style="color: #e7e7e7;">Shell: bash 5.2.37</span>
<span style="color: #E57000;">        -+ooooooo/.</span><span style="color: #e7e7e7;">'sMMs'</span><span style="color: #E57000;">./ooooooo+-            </span><span style="color: #e7e7e7;">Display (VGA-1): 1024x768 @ 60 Hz</span>
<span style="color: #E57000;">          :oooooooo/</span><span style="color: #e7e7e7;">'..'</span><span style="color: #E57000;">/oooooooo:              </span><span style="color: #e7e7e7;">Terminal: termproxy</span>
<span style="color: #E57000;">          :oooooooo/'</span><span style="color: #e7e7e7;">..</span><span style="color: #E57000;">'/oooooooo:              </span><span style="color: #e7e7e7;">CPU: Intel(R) Xeon(R) D-1541 (16) @ 2.70 GHz <span class="nlive" data-live="temp"></span></span>
<span style="color: #E57000;">        -+ooooooo/.'</span><span style="color: #e7e7e7;">sMMs</span><span style="color: #E57000;">'./ooooooo+-            </span><span style="color: #e7e7e7;">CPU Usage: <span class="nlive" data-live="cpu">—</span></span>
<span style="color: #E57000;">      .+ooooooo+-'</span><span style="color: #e7e7e7;">oNMMMMNo</span><span style="color: #E57000;">'-+ooooooo+.          </span><span style="color: #e7e7e7;">GPU 1: ASPEED Technology, Inc. ASPEED Graphics Family</span>
<span style="color: #E57000;">    ./ooooooo+- </span><span style="color: #e7e7e7;">+NMMMMMMMMN+ </span><span style="color: #E57000;">-+ooooooo/.        </span><span style="color: #e7e7e7;">GPU 2: NVIDIA Quadro M2000 [Discrete]</span>
<span style="color: #E57000;">  '/oooooooo:'</span><span style="color: #e7e7e7;">:mMMMMMMMMMMMMm:</span><span style="color: #E57000;">':oooooooo/'      </span><span style="color: #e7e7e7;">Memory: <span class="nlive" data-live="mem-used">31.92 GiB</span> / <span class="nlive" data-live="mem-total">62.69 GiB</span> (</span><span class="nlive" data-live="mem-pct" style="color: #06e236;">51%</span><span style="color: #e7e7e7;">)</span>
<span style="color: #E57000;">':oooooooo/'</span><span style="color: #e7e7e7;">-hMMMMMMMyyMMMMMMMh-</span><span style="color: #E57000;">'/oooooooo:'    </span><span style="color: #e7e7e7;">Swap: Disabled</span>
<span style="color: #E57000;">'-/+oo+/:'</span><span style="color: #e7e7e7;">.yMMMMMMMh-  -hMMMMMMMy.</span><span style="color: #E57000;">':/+oo+/-'    </span><span style="color: #e7e7e7;">Disk (/): <span class="nlive" data-live="disk-used">3.13 GiB</span> / <span class="nlive" data-live="disk-total">430.18 GiB</span> (</span><span class="nlive" data-live="disk-pct" style="color: #06e236;">1%</span><span style="color: #e7e7e7;">) - zfs</span>
<span style="color: #e7e7e7;">        'sMMMMMMMm:      :dMMMMMMMs'</span>            <span style="color: #e7e7e7;">Disk (/rpool): 128.00 KiB / 427.05 GiB (</span><span style="color: #06e236;">0%</span><span style="color: #e7e7e7;">) - zfs</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'</span>           <span style="color: #e7e7e7;">Local IP (vmbr0): 192.168.178.242/24</span>
<span style="color: #e7e7e7;">         '://:'              '://:'</span>             <span style="color: #e7e7e7;">Locale: en_US.UTF-8</span>
                                                <span style="color: #e7e7e7;">ZFS Pools: <span class="nlive" data-live="pools">—</span></span>
                                                <span style="color: #e7e7e7;">Services: <span class="nlive" data-live="svc">—</span></span>`
    },
    {
      id: 'sw-01',
      tab: 'sw-01',
      group: 'server',
      title: 'sw-01.lucya.intra // edgeswitch 48 lite',
      width: 720,
      live: 'sw-01',
      // EdgeSwitch has no fastfetch: the hardware lines come from the
      // datasheet, every other figure from the checkmk probe or a dash.
      content: `<span style="color:#2074cf;">  .--------------------------------.    </span><span style="color:#44a9fe;">lucya</span><span style="color:#8a8f98;">@</span><span style="color:#44a9fe;">sw-01</span>
<span style="color:#2074cf;">  | [=][=][=][=][=][=][=][=]  o o  |    </span><span style="color:#8a8f98;">-----------</span>
<span style="color:#2074cf;">  | [=][=][=][=][=][=][=][=]  o o  |    </span><span style="color:#44a9fe;">Host:</span><span style="color:#e7e7e7;"> Ubiquiti EdgeSwitch 48 Lite (ES-48-LITE)</span>
<span style="color:#2074cf;">  '--------------------------------'    </span><span style="color:#44a9fe;">Uptime:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="uptime">—</span></span>
                                        <span style="color:#44a9fe;">Ports:</span><span style="color:#e7e7e7;"> 48 x GbE · 2 x SFP+ · 2 x SFP</span>
                                        <span style="color:#44a9fe;">Ports up:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="ports">—</span> monitored</span>
<span style="color:#8a8f98;">   EdgeSwitch 48 Lite                   </span><span style="color:#44a9fe;">Traffic:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="traffic">—</span></span>
                                        <span style="color:#44a9fe;">Temperature:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="temp-c">—</span></span>
                                        <span style="color:#44a9fe;">Fans:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="fans">—</span></span>
                                        <span style="color:#44a9fe;">Services:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="svc">—</span></span>`
    },
    {
      id: 'esx-01',
      tab: 'esx-01',
      group: 'server',
      title: 'esx-01.lucya.intra // homelab virtualization host #01',
      width: 750,
      content: `<span style="color:#8dc242;">          ---------===========++  </span>  <span style="color:#56b6c2;">root@esx-01</span>
<span style="color:#8dc242;">         --------============+++  </span>  <span style="color:#56b6c2;">--------------------</span>
<span style="color:#8dc242;">         -----             =+++++ </span>  <span style="color:#e5c07b;">OS:</span> <span style="color:#ffffff;">VMware ESXi-8.0U3e</span>
<span style="color:#8dc242;">         -----   <span style="color:#fcba03;">::::::::</span>   <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Host:</span> <span style="color:#ffffff;">PowerEdge R720</span>
<span style="color:#8dc242;">   ----------=  <span style="color:#fcba03;">::::------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Kernel:</span> <span style="color:#ffffff;">VMkernel 24677879</span>
<span style="color:#8dc242;">  ---------===  <span style="color:#fcba03;">:::-------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Uptime:</span> <span style="color:#ffffff;">20 days 2 hours 11 mins</span>
<span style="color:#8dc242;"> :-----         <span style="color:#fcba03;">::--------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Shell:</span> <span style="color:#ffffff;">BusyBox + ESXi Shell</span>
<span style="color:#8dc242;"> :----          <span style="color:#fcba03;">:---------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Display:</span> <span style="color:#ffffff;">N/A (Headless)</span>
<span style="color:#8dc242;"> :----  <span style="color:#fcba03;">::::::::--------</span>    <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Hypervisor:</span> <span style="color:#ffffff;">vSphere 8.0.3 Enterprise+</span>
<span style="color:#8dc242;"> :---=  <span style="color:#fcba03;">:::::::---</span>         <span style="color:#8dc242;">=+++++ </span>  <span style="color:#e5c07b;">vCenter:</span> <span style="color:#ffffff;">Connected</span>
<span style="color:#8dc242;"> --===  <span style="color:#fcba03;">::::::----</span>  <span style="color:#8dc242;">-+++++++++++  </span>  <span style="color:#e5c07b;">CPU:</span> <span style="color:#ffffff;">2 x Intel(R) Xeon(R) E5-2670 0 (32) @ 3.60GHz</span>
<span style="color:#8dc242;"> -====  <span style="color:#fcba03;">:::::-----</span>  <span style="color:#8dc242;">-++++++++++   </span>  <span style="color:#e5c07b;">Memory:</span> <span style="color:#ffffff;">403.20 GiB / 863.94 GiB</span>
<span style="color:#8dc242;"> =====   <span style="color:#fcba03;">::::----</span>   <span style="color:#8dc242;">-++++         </span>  <span style="color:#e5c07b;">Swap:</span> <span style="color:#ffffff;">0 B / 44.00 GiB</span>
<span style="color:#8dc242;"> ======             =++++         </span>  <span style="color:#e5c07b;">Datastore (SSD1):</span> <span style="color:#ffffff;">47.69 GiB / 58.37 GiB (82%)</span>
<span style="color:#8dc242;">  ======+++++++++++++++++         </span>  <span style="color:#e5c07b;">Datastore (HDD1):</span> <span style="color:#ffffff;">68.32 GiB / 1.82 TiB (4%)</span>
<span style="color:#8dc242;">   ====+++++++++++++++++          </span>  <span style="color:#e5c07b;">Management IP:</span> <span style="color:#ffffff;">10.0.3.1/8</span>
                                    <span style="color:#e5c07b;">Locale:</span> <span style="color:#ffffff;">de-DE</span>`
    },
    {
      id: 'esx-02',
      tab: 'esx-02',
      group: 'server',
      title: 'esx-02.lucya.intra // homelab virtualization host #02',
      width: 750,
      content: `<span style="color:#FFB3BA;">          ---------===========++  </span>  <span style="color:#56b6c2;">root@esx-02</span>
<span style="color:#FFCCB3;">         --------============+++  </span>  <span style="color:#56b6c2;">--------------------</span>
<span style="color:#FFDAB3;">         -----             =+++++ </span>  <span style="color:#e5c07b;">OS:</span> <span style="color:#ffffff;">VMware ESXi-8.0U3e</span>
<span style="color:#FFE8B3;">         -----   </span><span style="color:#FFFFB3;">::::::::</span><span style="color:#FFE8B3;">   =++++ </span>  <span style="color:#e5c07b;">Host:</span> <span style="color:#ffffff;">IBM System x3650 M5</span>
<span style="color:#FFFFB3;">   ----------=  </span><span style="color:#E8FFB3;">::::------</span><span style="color:#FFFFB3;">  =++++ </span>  <span style="color:#e5c07b;">Kernel:</span> <span style="color:#ffffff;">VMkernel 24677879</span>
<span style="color:#E8FFB3;">  ---------===  </span><span style="color:#CCFFB3;">:::-------</span><span style="color:#E8FFB3;">  =++++ </span>  <span style="color:#e5c07b;">Uptime:</span> <span style="color:#ffffff;">27 days 2 hours 11 mins</span>
<span style="color:#CCFFB3;"> :-----         </span><span style="color:#B3FFB3;">::--------</span><span style="color:#CCFFB3;">  =++++ </span>  <span style="color:#e5c07b;">Shell:</span> <span style="color:#ffffff;">BusyBox + ESXi Shell</span>
<span style="color:#B3FFB3;"> :----          </span><span style="color:#B3FFCC;">:---------</span><span style="color:#B3FFB3;">  =++++ </span>  <span style="color:#e5c07b;">Display:</span> <span style="color:#ffffff;">N/A (Headless)</span>
<span style="color:#B3FFCC;"> :----  </span><span style="color:#B3FFE8;">::::::::--------</span><span style="color:#B3FFCC;">    =++++ </span>  <span style="color:#e5c07b;">Hypervisor:</span> <span style="color:#ffffff;">vSphere 8.0.3 Enterprise+</span>
<span style="color:#B3FFE8;"> :---=  </span><span style="color:#B3FFFF;">:::::::---</span><span style="color:#B3FFE8;">         =+++++ </span>  <span style="color:#e5c07b;">vCenter:</span> <span style="color:#ffffff;">Connected</span>
<span style="color:#B3FFFF;"> --===  </span><span style="color:#B3E8FF;">::::::----</span><span style="color:#B3FFFF;">  -+++++++++++  </span>  <span style="color:#e5c07b;">CPU:</span> <span style="color:#ffffff;">2 x Intel(R) Xeon(R) E5-2640 v3 (16) @ 2.60GHz</span>
<span style="color:#B3E8FF;"> -====  </span><span style="color:#B3CCFF;">:::::-----</span><span style="color:#B3E8FF;">  -++++++++++   </span>  <span style="color:#e5c07b;">Memory:</span> <span style="color:#ffffff;">203.22 GiB / 335,31 GiB</span>
<span style="color:#B3CCFF;"> =====   </span><span style="color:#CCB3FF;">::::----</span><span style="color:#B3CCFF;">   -++++         </span>  <span style="color:#e5c07b;">Swap:</span> <span style="color:#ffffff;">0 B / 44.00 GiB</span>
<span style="color:#CCB3FF;"> ======             =++++         </span>  <span style="color:#e5c07b;">Datastore (SSD1):</span> <span style="color:#ffffff;">49.23 GiB / 58.37 GiB</span>
<span style="color:#E8B3FF;">  ======+++++++++++++++++         </span>  <span style="color:#e5c07b;">Datastore (HDD1):</span> <span style="color:#ffffff;">248.22 GiB / 1.82 TiB</span>
<span style="color:#FFB3E8;">   ====+++++++++++++++++          </span>  <span style="color:#e5c07b;">Management IP:</span> <span style="color:#ffffff;">10.0.3.2/8</span>
                                    <span style="color:#e5c07b;">Locale:</span> <span style="color:#ffffff;">de-DE</span>`
    },
    {
      id: 'backup-01',
      tab: 'backup-01',
      group: 'server',
      title: 'backup-01.lucya.intra // thinkstation c20x / old backup pc',
      width: 1020,
      content: `<span style="color:#ee0303;">        ,.=:!!t3Z3z.,</span>                   <span style="color:#08e008;">lucya@backup-01</span>
<span style="color:#ee0303;">       :tt:::tt333EE3</span>                   <span style="color:#08e008;">---------------</span>
<span style="color:#ee0303;">       Et:::ztt33EEEL</span> <span style="color:#08e008;">@Ee.,      ..,</span>    <span style="color:#e5c07b;">OS:</span> <span style="color:#ffffff;">Windows 7 Professional x86_64</span>
<span style="color:#ee0303;">      ;tt:::tt333EE7</span> <span style="color:#08e008;">;EEEEEEttttt33#</span>    <span style="color:#e5c07b;">Host:</span> <span style="color:#ffffff;">4269A55 (ThinkStation C20X)</span>
<span style="color:#ee0303;">     :Et:::zt333EEQ.</span> <span style="color:#08e008;">$EEEEEttttt33QL</span>    <span style="color:#e5c07b;">Kernel:</span> <span style="color:#ffffff;">WIN32_NT 6.1.7601.0 (Service Pack 1)</span>
<span style="color:#ee0303;">     it::::tt333EEF</span> <span style="color:#08e008;">@EEEEEEttttt33F</span>     <span style="color:#e5c07b;">Uptime:</span> <span style="color:#ffffff;">3 mins</span>
<span style="color:#ee0303;">    ;3=*^..."*4EEV</span> <span style="color:#08e008;">:EEEEEEttttt33@.</span>     <span style="color:#e5c07b;">Shell:</span> <span style="color:#ffffff;">CMD 6.1.7601.17514</span>
<span style="color:#12a0e7;">    ,.=::::!t=.,  </span> <span style="color:#08e008;">@EEEEEEtttz33QF</span>      <span style="color:#e5c07b;">DE:</span> <span style="color:#ffffff;">Aero</span>
<span style="color:#12a0e7;">   ;::::::::zt33)</span>   <span style="color:#08e008;">"4EEEtttji3P*"</span>      <span style="color:#e5c07b;">WM:</span> <span style="color:#ffffff;">Internal</span>
<span style="color:#12a0e7;">  :t::::::::tt33.<span style="color:#f3dd14;">:Z3z..</span>  <span style="color:#f3dd14;">.. ,..g.</span>       <span style="color:#e5c07b;">WM Theme:</span> <span style="color:#ffffff;">Aero - #74B8FC</span>
<span style="color:#12a0e7;">  i::::::::zt33F</span> <span style="color:#f3dd14;">AEEEtttt::::ztF</span>        <span style="color:#e5c07b;">Font:</span> <span style="color:#ffffff;">Segoe UI (12pt) [Caption / Menu / Message / Status]</span>
<span style="color:#12a0e7;"> ;:::::::::t33V</span> <span style="color:#f3dd14;">;EEEttttt::::t3</span>         <span style="color:#e5c07b;">Cursor:</span> <span style="color:#ffffff;">Windows-Aero</span>
<span style="color:#12a0e7;"> E::::::::zt33L</span> <span style="color:#f3dd14;">@EEEtttt::::z3F</span>         <span style="color:#e5c07b;">Terminal:</span> <span style="color:#ffffff;">ConEmuC64 230724</span>
<span style="color:#12a0e7;">{3=*^..."*4E3)</span> <span style="color:#f3dd14;">;EEEtttt:::::tZ.</span>         <span style="color:#e5c07b;">Terminal Font:</span> <span style="color:#ffffff;">Consola (14pt)</span>
<span style="color:#12a0e7;">             .</span> <span style="color:#f3dd14;">:EEEEtttt::::z7</span>          <span style="color:#e5c07b;">CPU:</span> <span style="color:#ffffff;">Intel(R) Xeon(R) X5690 (12) @ 3.47 GHz</span>
<span style="color:#f3dd14;">                 "VEzjt:;;z>*.</span>          <span style="color:#e5c07b;">GPU:</span> <span style="color:#ffffff;">NVIDIA Quadro 2000</span>
                                        <span style="color:#e5c07b;">Memory:</span> <span style="color:#ffffff;">3.74 GiB / 23.99 GiB (16%)</span>
                                        <span style="color:#e5c07b;">Swap:</span> <span style="color:#ffffff;">0 B / 23.99 GiB (0%)</span>
                                        <span style="color:#e5c07b;">Disk (C:\\):</span> <span style="color:#ffffff;">65.60 GiB / 476.84 GiB (14%) - NTFS</span>
                                        <span style="color:#e5c07b;">Disk (D:\\):</span> <span style="color:#ffffff;">331.20 GiB / 931.39 GiB (36%) - NTFS</span>
                                        <span style="color:#e5c07b;">Local IP (LAN-Verbindung 2):</span> <span style="color:#ffffff;">10.174.110.143/24</span>
                                        <span style="color:#e5c07b;">Locale:</span> <span style="color:#ffffff;">de-DE</span>`
    },
    {
      id: 'vanta',
      tab: 'vanta',
      group: 'desktop',
      title: 'vanta.lucya.intra // main system',
      width: 680,
      content: `<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">lucya@vanta</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#767676;">-----------</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">OS:</span> <span style="color:#F2F2F2;">Windows 11 Pro [64-bit]</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Host:</span> <span style="color:#F2F2F2;">Gigabyte A520 AORUS ELITE</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Kernel:</span> <span style="color:#F2F2F2;">WIN32_NT 10.0.26100.0</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Motherboard:</span> <span style="color:#F2F2F2;">Gigabyte A520 AORUS ELITE</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Uptime:</span> <span style="color:#F9F1A5;">30 minutes</span>
                                    <span style="color:#F9F1A5;">Packages:</span> <span style="color:#F2F2F2;">1 (scoop)</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Shell:</span> <span style="color:#F2F2F2;">PowerShell v5.1.26100.2161</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Resolution:</span> <span style="color:#F2F2F2;">1050x1680, 2560x1440</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Terminal:</span> <span style="color:#F2F2F2;">Windows Terminal</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">CPU:</span> <span style="color:#F2F2F2;">AMD Ryzen 7 5800X3D (8) @ 3.39 GHz</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">GPU 1:</span> <span style="color:#F2F2F2;">Parsec Virtual Display Adapter</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">GPU 2:</span> <span style="color:#F2F2F2;">Meta Virtual Monitor</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">GPU 3:</span> <span style="color:#F2F2F2;">NVIDIA GeForce RTX 3060 12GB</span>
                                    <span style="color:#F9F1A5;">CPU Usage:</span> [ <span style="color:#16C60C;">■</span><span style="color:#F2F2F2;">--------</span>]
                                    <span style="color:#F9F1A5;">Memory:</span> <span style="color:#F2F2F2;">11.39 GiB / 31.89 GiB</span> [ <span style="color:#16C60C;">■■■■</span>------ ]
                                    <span style="color:#F9F1A5;">Disk (C:\\):</span> [ <span style="color:#16C60C;">■■■■■■■</span>--- ] <span style="color:#F2F2F2;">638 GiB / 930 GiB</span>
                                    <span style="color:#F9F1A5;">Locale:</span> <span style="color:#F2F2F2;">Japan - ja-JP</span>
                                    <span style="color:#F9F1A5;">Local IP:</span> <span style="color:#F2F2F2;">192.168.200.5</span>`
    },
    {
      id: 'orcus',
      tab: 'orcus',
      group: 'desktop',
      title: 'orcus.lucya.intra // imac mid 2011 21.5 inch',
      width: 730,
      content: `<span style="color:#61BB46;">                     ..'</span>          <span style="color: #33cc33;">lucya@Orcus</span>
<span style="color:#61BB46;">                 ,xNMM.</span>           <span style="color: #33cc33;">-----------</span>
<span style="color:#61BB46;">               .OMMMMo</span>            <span style="color: #e5c07b;">OS:</span> <span style="color: #ffffff;">macOS Sequoia 15.1.1 x86_64</span>
<span style="color:#61BB46;">               lMM"</span>               <span style="color: #e5c07b;">Host:</span> <span style="color: #ffffff;">iMac (21.5-inch, Mid 2011)</span>
<span style="color:#61BB46;">     .;loddo:.  .olloddol;.</span>       <span style="color: #e5c07b;">Kernel:</span> <span style="color: #ffffff;">Darwin 24.1.0</span>
<span style="color:#61BB46;">   cKMMMMMMMMMMNWMMMMMMMMMM0:</span>     <span style="color: #e5c07b;">Uptime:</span> <span style="color: #ffffff;">11 mins</span>
<span style="color:#FDB827;"> .KMMMMMMMMMMMMMMMMMMMMMMMWd.</span>     <span style="color: #e5c07b;">Packages:</span> <span style="color: #ffffff;">1 (brew)</span>
<span style="color:#FDB827;"> XMMMMMMMMMMMMMMMMMMMMMMMX.</span>       <span style="color: #e5c07b;">Shell:</span> <span style="color: #ffffff;">zsh 5.9</span>
<span style="color:#E03A3E;">;MMMMMMMMMMMMMMMMMMMMMMMM:</span>        <span style="color: #e5c07b;">Display (iMac):</span> <span style="color: #ffffff;">1920x1080 @ 60 Hz in 21" [Built-in]</span>
<span style="color:#E03A3E;">:MMMMMMMMMMMMMMMMMMMMMMMM:</span>        <span style="color: #e5c07b;">DE:</span> <span style="color: #ffffff;">Aqua</span>
<span style="color:#E03A3E;">.MMMMMMMMMMMMMMMMMMMMMMMX.</span>        <span style="color: #e5c07b;">WM:</span> <span style="color: #ffffff;">Quartz Compositor 278.1.10</span>
<span style="color:#E03A3E;"> kMMMMMMMMMMMMMMMMMMMMMMMMWd.</span>     <span style="color: #e5c07b;">WM Theme:</span> <span style="color: #ffffff;">Multicolor (Dark)</span>
<span style="color:#963D97;"> 'XMMMMMMMMMMMMMMMMMMMMMMMMMMk</span>    <span style="color: #e5c07b;">Font:</span> <span style="color: #ffffff;">.AppleSystemUIFont [System], Helvetica [User]</span>
<span style="color:#963D97;">  'XMMMMMMMMMMMMMMMMMMMMMMMMK.</span>    <span style="color: #e5c07b;">Cursor:</span> <span style="color: #ffffff;">Fill - Black, Outline - White (32px)</span>
<span style="color:#009DDC;">    kMMMMMMMMMMMMMMMMMMMMMMd</span>      <span style="color: #e5c07b;">Terminal:</span> <span style="color: #ffffff;">Apple Terminal 455</span>
<span style="color:#009DDC;">     ;KMMMMMMMWXXWMMMMMMMk.</span>       <span style="color: #e5c07b;">Terminal Font:</span> <span style="color: #ffffff;">SFMono-Regular (11pt)</span>
<span style="color:#009DDC;">       "cooc*"    "*coo'"</span>         <span style="color: #e5c07b;">CPU:</span> <span style="color: #ffffff;">Intel(R) Core(TM) i5-2500S (4) @ 2.70 GHz</span>
                                  <span style="color: #e5c07b;">GPU 1:</span> <span style="color: #ffffff;">AMD Radeon HD 6770M [Discrete]</span>
                                  <span style="color: #e5c07b;">GPU 2:</span> <span style="color: #ffffff;">Intel HD Graphics 3000 [Integrated]</span>
                                  <span style="color: #e5c07b;">Memory:</span> <span style="color: #ffffff;">5.35 GiB / 8.00 GiB (67%)</span>
                                  <span style="color: #e5c07b;">Swap:</span> <span style="color: #ffffff;">Disabled</span>
                                  <span style="color: #e5c07b;">Disk (/):</span> <span style="color: #ffffff;">63.28 GiB / 111.60 GiB (57%) - apfs</span>
                                  <span style="color: #e5c07b;">Local IP (en1):</span> <span style="color: #ffffff;">192.168.178.109/24</span>
                                  <span style="color: #e5c07b;">Locale:</span> <span style="color: #ffffff;">C</span>`
    },
    {
      id: 'aoi',
      tab: 'aoi',
      group: 'mobile',
      title: 'aoi.lucya.intra // mobile workstation',
      width: 890,
      content: `<span style="color: #50FA7B;">                                  lucya</span><span style="color: #BFBFBF;">@</span><span style="color: #50FA7B;">aoi</span>
<span style="color: #BFBFBF;">                                  ---------</span>

<span style="color: #F1FA8C;">                                  모Hardware</span>
<span style="color: #F1FA8C;">                                  ├ Model</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Apple Inc. MacBook Pro (16-inch, 2019) 1.0</span>
<span style="color: #50FA7B;">                     ..'</span><span style="color: #F1FA8C;">          ├ Screen</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 4096 x 2560 px @  60 Hz in 16" (302 ppi) - 8 bit - HDR: true</span>
<span style="color: #50FA7B;">                 ,xNMM.</span><span style="color: #F1FA8C;">           ├ Bright</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 100%</span>
<span style="color: #50FA7B;">               .OMMMMo</span><span style="color: #F1FA8C;">            ├ CPU</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Intel(R) Core(TM) i7-9750H - 12 core @ 2.60 GHz - 73.8°C</span>
<span style="color: #50FA7B;">               lMM"</span><span style="color: #F1FA8C;">               ├ GPU</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Intel UHD Graphics 630 - -1 core @  - 62.6°C - Metal 3</span>
<span style="color: #50FA7B;">     .;loddo:.  .olloddol;.</span><span style="color: #F1FA8C;">       ├ GPU</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> AMD Radeon Pro 5300M - -1 core @  - 47.6°C - Metal 3</span>
<span style="color: #50FA7B;">   cKMMMMMMMMMMNWMMMMMMMMMM0:</span><span style="color: #F1FA8C;">     ├ Memory</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 13.13 GiB / 16.00 GiB (82%)</span>
<span style="color: #F1FA8C;"> .KMMMMMMMMMMMMMMMMMMMMMMMWd.     ├ Disk</span>   <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> MacintoshHD (/) - 213.43 GiB / 278.47 GiB (77%) - apfs</span>
<span style="color: #F1FA8C;"> XMMMMMMMMMMMMMMMMMMMMMMMX.       ├ Disk</span>   <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> BOOTCAMP (/Volumes/BOOTCAMP) - 155.79 GiB / 186.42 GiB (84%) - ntfs</span>
<span style="color: #FF6E67;">;MMMMMMMMMMMMMMMMMMMMMMMM:</span><span style="color: #F1FA8C;">        ├ Charge</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 53% - 192 cycles - 35.4°C</span>
<span style="color: #FF6E67;">:MMMMMMMMMMMMMMMMMMMMMMMM:</span><span style="color: #F1FA8C;">        ├ Camera</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> FaceTime HD Camera (Built-in) - 640 x 480 px</span>
<span style="color: #FF5555;">.MMMMMMMMMMMMMMMMMMMMMMMMX.</span><span style="color: #F1FA8C;">       └ Sound</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> MacBook Pro Speakers - 60%</span>
<span style="color: #FF5555;"> kMMMMMMMMMMMMMMMMMMMMMMMMWd.</span>
<span style="color: #FF79C6;"> 'XMMMMMMMMMMMMMMMMMMMMMMMMMMk    Software</span>
<span style="color: #FF79C6;">  'XMMMMMMMMMMMMMMMMMMMMMMMMK.    ├ OS Ver</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> macOS Tahoe 26.2 - x86_64</span>
<span style="color: #BD93F9;">    kMMMMMMMMMMMMMMMMMMMMMMd</span><span style="color: #FF79C6;">      ├ Uptime</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 3 days, 23 hours, 33 mins</span>
<span style="color: #BD93F9;">     ;KMMMMMMMWXXWMMMMMMMk.</span><span style="color: #FF79C6;">       ├ Shell</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> zsh 5.9</span>
<span style="color: #BD93F9;">       "cooc*"    "*coo'"</span><span style="color: #FF79C6;">         ├ Tasks</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 921</span>
<span style="color: #FF79C6;">                                  └ Apps</span>   <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Total: 150 - User: 84 - System: 66</span>

<span style="color: #BD93F9;">                                  ᯤ Connectivity</span>
<span style="color: #BD93F9;">                                  ├ DNS</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 192.168.178.1</span>
<span style="color: #BD93F9;">                                  ├ Wi-Fi</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Varuna - 98% - 5 GHz - 802.11ac (Wi-Fi 5) - WPA2 Personal</span>
<span style="color: #BD93F9;">                                  └ BT Ver</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 5.2</span>`
    },
    {
      id: 'kira',
      tab: 'kira',
      group: 'mobile',
      title: "kira.lucya.intra // panasonic let's note CF-QV9 / main laptop / tablet",
      width: 1100,
      // Silver-to-blue gradients echo the Let's note finish.
      content: `<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#f0f3f6,#a8b8ca);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">lucya</span><span style="color:#A5AFBA;">@</span><span style="color:#83AED5;">KIRA</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#e7edf3,#9fb1c5);">/////////////////  /////////////////</span>    <span style="color:#A5AFBA;">----------</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#dfe8f0,#96aac0);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">OS:</span> <span style="color:#F2F2F2;">Windows 11 Pro (26H1) x86_64</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#d6e2ed,#8da3bb);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Host:</span> <span style="color:#F2F2F2;">CFQV9-1 (001)</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#cddcea,#859cb6);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Kernel:</span> <span style="color:#F2F2F2;">WIN32_NT 10.0.28000.3231</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#c4d6e7,#7c95b1);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Uptime:</span> <span style="color:#F2F2F2;">7 hours, 58 mins</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#bcd1e4,#738eac);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Shell:</span> <span style="color:#F2F2F2;">Windows PowerShell 5.1.28000.2605</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#b3cbe1,#6a87a7);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Display (AUO116D):</span> <span style="color:#F2F2F2;">2880x1920 @ 1.75x in 12", 60 Hz [Built-in]</span>
                                        <span style="color:#83AED5;">Window Manager:</span> <span style="color:#F2F2F2;">Desktop Window Manager 10.0.28000.2804</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#aac5de,#6180a3);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">WM Theme:</span> <span style="color:#F2F2F2;">Custom - #113864 (System: Dark, Apps: Dark)</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#a1bfdb,#58799e);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Theme:</span> <span style="color:#F2F2F2;">Fluent</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#99bad8,#4f7299);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Icons:</span> <span style="color:#F2F2F2;">Recycle Bin</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#90b4d5,#466b94);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Font:</span> <span style="color:#F2F2F2;">Segoe UI (21pt) [Caption / Menu / Message / Status]</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#87aed2,#3e648f);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Cursor:</span> <span style="color:#F2F2F2;">default (32px)</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#7ea8cf,#355d8a);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Terminal:</span> <span style="color:#F2F2F2;">Windows Terminal 1.24.12741.0</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#76a3cc,#2c5685);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">Terminal Font:</span> <span style="color:#F2F2F2;">0xProto Nerd Font (12pt)</span>
<span class="nlogo--kira" style="background-image:linear-gradient(110deg,#6d9dc9,#234f80);">/////////////////  /////////////////</span>    <span style="color:#83AED5;">CPU:</span> <span style="color:#F2F2F2;">Intel(R) Core(TM) i5-10310U (8) @ 2.21 GHz</span>
                                        <span style="color:#83AED5;">GPU:</span> <span style="color:#F2F2F2;">Intel(R) UHD Graphics (128.00 MiB) [Integrated]</span>
                                        <span style="color:#83AED5;">Memory:</span> <span style="color:#F2F2F2;">12.90 GiB / 15.70 GiB (82%)</span>
                                        <span style="color:#83AED5;">Swap:</span> <span style="color:#F2F2F2;">619.84 MiB / 2.88 GiB (21%)</span>
                                        <span style="color:#83AED5;">Disk (C:\\):</span> <span style="color:#F2F2F2;">150.67 GiB / 237.41 GiB (63%) - NTFS</span>
                                        <span style="color:#83AED5;">Local IP (Wi-Fi):</span> <span style="color:#F2F2F2;">192.168.11.11/24</span>
                                        <span style="color:#83AED5;">Battery (CF-VZSU1M):</span> <span style="color:#F2F2F2;">100% [AC Connected]</span>
                                        <span style="color:#83AED5;">Locale:</span> <span style="color:#F2F2F2;">en_DE.CP437</span>`
    },
    {
      id: 'ceres',
      tab: 'ceres',
      group: 'mobile',
      title: 'ceres.lucya.intra // macbook 12-inch 2017',
      width: 1000,
      content: `<span style="color:#61BB46;">                     ..'</span>          <span style="color: #33cc33;">lucya@Ceres</span>
<span style="color:#61BB46;">                 ,xNMM.</span>           <span style="color: #33cc33;">-----------</span>
<span style="color:#61BB46;">               .OMMMMo</span>            <span style="color: #e5c07b;">OS:</span> <span style="color: #ffffff;">macOS Ventura 13.7.8 (22H730) x86_64</span>
<span style="color:#61BB46;">               lMM"</span>               <span style="color: #e5c07b;">Host:</span> <span style="color: #ffffff;">MacBook (Retina, 12-inch, 2017) (1.0)</span>
<span style="color:#61BB46;">     .;loddo:.  .olloddol;.</span>       <span style="color: #e5c07b;">Kernel:</span> <span style="color: #ffffff;">Darwin 22.6.0</span>
<span style="color:#61BB46;">   cKMMMMMMMMMMNWMMMMMMMMMM0:</span>     <span style="color: #e5c07b;">Uptime:</span> <span style="color: #ffffff;">17 hours, 38 mins</span>
<span style="color:#FDB827;"> .KMMMMMMMMMMMMMMMMMMMMMMMWd.</span>     <span style="color: #e5c07b;">Shell:</span> <span style="color: #ffffff;">zsh 5.9</span>
<span style="color:#FDB827;"> XMMMMMMMMMMMMMMMMMMMMMMMX.</span>       <span style="color: #e5c07b;">Display (Color LCD):</span> <span style="color: #ffffff;">2880x1800 @ 2x in 12", 60 Hz [Built-in]</span>
<span style="color:#E03A3E;">;MMMMMMMMMMMMMMMMMMMMMMMM:</span>        <span style="color: #e5c07b;">Window Manager:</span> <span style="color: #ffffff;">Quartz Compositor 1.600.0 (with Rectangle 1.100)</span>
<span style="color:#E03A3E;">:MMMMMMMMMMMMMMMMMMMMMMMM:</span>        <span style="color: #e5c07b;">WM Theme:</span> <span style="color: #ffffff;">Multicolor (Dark)</span>
<span style="color:#E03A3E;">.MMMMMMMMMMMMMMMMMMMMMMMMX.</span>       <span style="color: #e5c07b;">Theme:</span> <span style="color: #ffffff;">Aqua</span>
<span style="color:#E03A3E;"> kMMMMMMMMMMMMMMMMMMMMMMMMWd.</span>     <span style="color: #e5c07b;">Font:</span> <span style="color: #ffffff;">.AppleSystemUIFont [System], Helvetica [User]</span>
<span style="color:#963D97;"> 'XMMMMMMMMMMMMMMMMMMMMMMMMMMk</span>    <span style="color: #e5c07b;">Cursor:</span> <span style="color: #ffffff;">Fill - Black, Outline - White (32px)</span>
<span style="color:#963D97;">  'XMMMMMMMMMMMMMMMMMMMMMMMMK.</span>    <span style="color: #e5c07b;">Terminal:</span> <span style="color: #ffffff;">ghostty 1.3.1</span>
<span style="color:#009DDC;">    kMMMMMMMMMMMMMMMMMMMMMMd</span>      <span style="color: #e5c07b;">Terminal Font:</span> <span style="color: #ffffff;">0xProto Nerd Font (13pt)</span>
<span style="color:#009DDC;">     ;KMMMMMMMWXXWMMMMMMMk.</span>       <span style="color: #e5c07b;">CPU:</span> <span style="color: #ffffff;">Intel(R) Core(TM) m3-7Y32 (4) @ 1.20 GHz</span>
<span style="color:#009DDC;">       "cooc*"    "*coo'"</span>         <span style="color: #e5c07b;">GPU:</span> <span style="color: #ffffff;">Intel HD Graphics 615 [Integrated]</span>
                                  <span style="color: #e5c07b;">Memory:</span> <span style="color: #ffffff;">4.64 GiB / 8.00 GiB (58%)</span>
                                  <span style="color: #e5c07b;">Swap:</span> <span style="color: #ffffff;">290.50 MiB / 1.00 GiB (28%)</span>
                                  <span style="color: #e5c07b;">Disk (/):</span> <span style="color: #ffffff;">42.68 GiB / 233.47 GiB (18%) - apfs [Read-only]</span>
                                  <span style="color: #e5c07b;">Disk (/Volumes/Backup):</span> <span style="color: #ffffff;">161.35 GiB / 465.57 GiB (35%) - apfs [External]</span>
                                  <span style="color: #e5c07b;">Disk (/Volumes/Ceres):</span> <span style="color: #ffffff;">161.35 GiB / 465.57 GiB (35%) - apfs [External]</span>
                                  <span style="color: #e5c07b;">Local IP (en0):</span> <span style="color: #ffffff;">192.168.11.38/24</span>
                                  <span style="color: #e5c07b;">Battery (bq20z451):</span> <span style="color: #ffffff;">74% [AC Connected, Charging]</span>
                                  <span style="color: #e5c07b;">Power Adapter:</span> <span style="color: #ffffff;">60W</span>
                                  <span style="color: #e5c07b;">Locale:</span> <span style="color: #ffffff;">en_US.UTF-8</span>`
    },
    {
      id: 'kolibri',
      tab: 'kolibri',
      group: 'mobile',
      title: 'kolibri.lucya.intra // laptop / tablet',
      width: 1000,
      content: `<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#56b6c2;">lucya@kolibri</span>
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#56b6c2;">--------------</span>
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">OS:</span> Windows 11 Pro x86_64
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Host:</span> Surface Pro 7
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Kernel:</span> WIN32_NT 10.0.26100.3194 (24H2)
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Uptime:</span> 2 days, 2 hours, 48 mins
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Shell:</span> CMD 10.0.26100.3037
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Display (Default_Monitor):</span> 2560x1440 @ 32 Hz
                                        <span style="color:#e5c07b;">DE:</span> Fluent
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">WM:</span> Desktop Window Manager 10.0.26100.3037
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">WM Theme:</span> Custom - #3A3A3A (System: Dark, Apps: Dark)
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Icons:</span> Recycle Bin
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Font:</span> Segoe UI (12pt) [Caption / Menu / Message / Status]
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Cursor:</span> Windows Aero (48px)
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Terminal:</span> Windows Terminal 1.21.10351.0
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Terminal Font:</span> Cascadia Mono (12pt)
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">CPU:</span> Intel(R) Core(TM) i5-1035G4 (8) @ 1,50 GHz
                                        <span style="color:#e5c07b;">GPU 1:</span> Intel Meta Virtual Monitor (128,00 MiB) [Discrete]
                                        <span style="color:#e5c07b;">GPU 2:</span> Intel Parsec Virtual Display Adapter (128,00 MiB) [Discrete]
                                        <span style="color:#e5c07b;">GPU 3:</span> Intel(R) Iris(R) Plus Graphics (128,00 MiB) [Integrated]
                                        <span style="color:#e5c07b;">Memory:</span> 6,07 GiB / 7,60 GiB (<span style="color: #e5c07b;">80%</span>)
                                        <span style="color:#e5c07b;">Swap:</span> 175,52 MiB / 1,94 GiB (<span style="color: #e5c07b;">9%</span>)
                                        <span style="color:#e5c07b;">Disk (C:\\):</span> 102,81 GiB / 118,14 GiB (<span style="color: #e5c07b;">87%</span>) - NTFS
                                        <span style="color:#e5c07b;">Disk (D:\\):</span> 101,03 GiB / 119,08 GiB (<span style="color: #e5c07b;">85%</span>) - NTFS [External]
                                        <span style="color:#e5c07b;">Local IP (Wi-Fi):</span> 192.168.178.98/24
                                        <span style="color:#e5c07b;">Battery:</span> 100% [AC Connected]
                                        <span style="color:#e5c07b;">Locale:</span> en-DE`
    },
    {
      id: 'rubicon',
      tab: 'rubicon',
      group: 'mobile',
      title: 'rubicon.lucya.intra // linux macbook',
      width: 820,
      content: `<span style="color: #EDAECA;">                                           </span><span style="color: #D26BA4;">lucya</span><span style="color: #EDAECA;">@</span><span style="color: #D26BA4;">Rubicon</span>
<span style="color: #D26BA4;">           ..:/ossyyyysso/:.</span>               <span style="color: #EDAECA;">-------------</span>
<span style="color: #D26BA4;">        .:oyyyyyyyyyyyyyyyyyyo:.</span>           <span style="color: #56C4EB;">OS:</span> <span style="color: #EDAECA;">Kubuntu 25.10 x86_64</span>
<span style="color: #EDAECA;">      -oyyyyyyyo</span><span style="color: #FFFFFF;">dMM</span><span style="color: #EDAECA;">yyyyyyyysyyyyo-</span>         <span style="color: #56C4EB;">Host:</span> <span style="color: #EDAECA;">MacBookPro11,1 1.0</span>
<span style="color: #EDAECA;">    -syyyyyyyyyy</span><span style="color: #FFFFFF;">dMM</span><span style="color: #EDAECA;">yoyyyy</span><span style="color: #FFFFFF;">dmMM</span><span style="color: #EDAECA;">yyyyys-</span>       <span style="color: #56C4EB;">Kernel:</span> <span style="color: #EDAECA;">6.17.0-6-generic</span>
<span style="color: #EDAECA;">   oyyys</span><span style="color: #FFFFFF;">dM</span><span style="color: #EDAECA;">ysyyyy</span><span style="color: #FFFFFF;">dMMMMMMMMMMMMM</span><span style="color: #EDAECA;">yyyyyyyo</span>     <span style="color: #56C4EB;">Uptime:</span> <span style="color: #EDAECA;">50 secs</span>
<span style="color: #FFFFFF;">  oyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">ysyysoooooo</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">yyyyyyyyyo </span>    <span style="color: #56C4EB;">Packages:</span> <span style="color: #EDAECA;">2525 (dpkg), 7 (flatpak-system), 25 (snap)</span>
<span style="color: #FFFFFF;"> oyyyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">yyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMM</span><span style="color: #FFFFFF;">ysssssyyyo</span>    <span style="color: #56C4EB;">Shell:</span> <span style="color: #EDAECA;">zsh 5.9</span>
<span style="color: #FFFFFF;">-yyyyyyyy</span><span style="color: #FFFFFF;">dM</span><span style="color: #FFFFFF;">ysyyyyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #FFFFFF;">ysyyy-</span>   <span style="color: #56C4EB;">Resolution:</span> <span style="color: #EDAECA;">2560x1600</span>
<span style="color: #56C4EB;">oyyyysoo</span><span style="color: #FFFFFF;">dM</span><span style="color: #56C4EB;">yyyyyyyyyyyyyyyyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #56C4EB;">ysyyyo</span>   <span style="color: #56C4EB;">DE:</span> <span style="color: #EDAECA;">Plasma 6.4.5 [KF 6.17.0] [Qt 6.9.2] (wayland)</span>
<span style="color: #56C4EB;">yyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #56C4EB;">yyyyyyyyyyyyyyyyyyysosyyyyyyyy</span>   <span style="color: #56C4EB;">WM:</span> <span style="color: #EDAECA;">kwin_wayland_wr</span>
<span style="color: #56C4EB;">yyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #56C4EB;">yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy</span>   <span style="color: #56C4EB;">Theme:</span> <span style="color: #EDAECA;">Breeze-Dark [GTK2/3]</span>
<span style="color: #56C4EB;">oyyyyysosdyyyyyyyyyyyyyyyyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #56C4EB;">ysyyyo</span>   <span style="color: #56C4EB;">Icons:</span> <span style="color: #EDAECA;">kora [GTK2/3]</span>
<span style="color: #FFFFFF;">-yyyyyyyy</span><span style="color: #FFFFFF;">dM</span><span style="color: #FFFFFF;">ysyyyyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #FFFFFF;">ysyyy-</span>   <span style="color: #56C4EB;">Cursor:</span> <span style="color: #EDAECA;">WinSur-dark-cursors [GTK2/3]</span>
<span style="color: #FFFFFF;"> oyyyyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #FFFFFF;">ysyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMM</span><span style="color: #FFFFFF;">yoyyyoyyyo</span>    <span style="color: #56C4EB;">Terminal:</span> <span style="color: #EDAECA;">konsole</span>
<span style="color: #FFFFFF;">  oyyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #FFFFFF;">ysyyyoooooo</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">yoyyyyyyyyo</span>     <span style="color: #56C4EB;">CPU:</span> <span style="color: #EDAECA;">Intel i5-4278U (4) @ 3.1GHz</span>
<span style="color: #EDAECA;">   oyyysyyoyyyys</span><span style="color: #FFFFFF;">dMMMMMMMMMMM</span><span style="color: #EDAECA;">yyyyyyyyo</span>      <span style="color: #56C4EB;">GPU:</span> <span style="color: #EDAECA;">Intel Haswell-ULT</span>
<span style="color: #EDAECA;">    -syyyyyyyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #EDAECA;">ysyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #EDAECA;">ysyyyys-</span>       <span style="color: #56C4EB;">Memory:</span> <span style="color: #EDAECA;">1.87 GiB / 7.66 GiB (24%)</span>
<span style="color: #EDAECA;">      -oyyyyyyy</span><span style="color: #FFFFFF;">dMM</span><span style="color: #EDAECA;">yyyyyyysosyyyyo-</span>         <span style="color: #56C4EB;">Network:</span> <span style="color: #EDAECA;">Wifi</span>
<span style="color: #D26BA4;">        ./oyyyyyyyyyyyyyyyyyyo/.</span>           <span style="color: #56C4EB;">Bluetooth:</span> <span style="color: #EDAECA;">Broadcom Corp. BCM2046B1 USB 2.0 Hub</span>
<span style="color: #D26BA4;">            .:/oosyyyysso/:. </span>              <span style="color: #56C4EB;">BIOS:</span> <span style="color: #EDAECA;">Apple Inc. 0.1 (01/13/2023)</span>`
    },
    {
      id: 'delta',
      tab: 'delta',
      group: 'mobile',
      title: 'delta.lucya.intra // main system',
      width: 680,
      content: `<span style="color: #61FFCA;">                  -'                     </span><span style="color: #EDECEE;">lucya</span><span style="color: #A277FF;">@</span><span style="color: #EDECEE;">delta</span>
<span style="color: #61FFCA;">                 .o+'                    </span><span style="color: #A277FF;">-------------</span>
<span style="color: #61FFCA;">                'ooo/                    </span><span style="color: #A277FF;">OS:</span><span style="color: #EDECEE;"> Arch Linux x86_64</span>
<span style="color: #61FFCA;">               '+oooo:                   </span><span style="color: #A277FF;">Host:</span><span style="color: #EDECEE;"> HP EliteBook 2570p (A1029D1102)</span>
<span style="color: #61FFCA;">              '+oooooo:                  </span><span style="color: #A277FF;">Kernel:</span><span style="color: #EDECEE;"> Linux 6.18.9-arch1-2</span>
<span style="color: #61FFCA;">              -+oooooo+:                 </span><span style="color: #A277FF;">Uptime:</span><span style="color: #EDECEE;"> 41 seconds</span>
<span style="color: #61FFCA;">            '/:-:++oooo+:                </span><span style="color: #A277FF;">Packages:</span><span style="color: #EDECEE;"> 820 (pacman)</span>
<span style="color: #61FFCA;">           '/++++/+++++++:               </span><span style="color: #A277FF;">Shell:</span><span style="color: #EDECEE;"> zsh 5.9</span>
<span style="color: #61FFCA;">          '/++++++++++++++:              </span><span style="color: #A277FF;">Display (AUO206C):</span><span style="color: #EDECEE;"> 1366x768 in 13", 60 Hz [Built-in]</span>
<span style="color: #61FFCA;">         '/+++ooooooooooooo/'            </span><span style="color: #A277FF;">DE:</span><span style="color: #EDECEE;"> KDE Plasma 6.5.5</span>
<span style="color: #61FFCA;">        ./ooosssso++osssssso+'           </span><span style="color: #A277FF;">WM:</span><span style="color: #EDECEE;"> KWin (Wayland)</span>
<span style="color: #61FFCA;">       .oossssso-''''/ossssss+'          </span><span style="color: #A277FF;">WM Theme:</span><span style="color: #EDECEE;"> Breeze</span>
<span style="color: #61FFCA;">      -osssssso.      :ssssssso.         </span><span style="color: #A277FF;">Theme:</span><span style="color: #EDECEE;"> Breeze (Dark) [Qt], Breeze-Dark [GTK2], Breeze [GTK3]</span>
<span style="color: #61FFCA;">     :osssssss/        osssso+++.        </span><span style="color: #A277FF;">Icons:</span><span style="color: #EDECEE;"> Papirus [Qt], Papirus [GTK2/3/4]</span>
<span style="color: #61FFCA;">    /ossssssss/        +ssssooo/-        </span><span style="color: #A277FF;">Font:</span><span style="color: #EDECEE;"> Noto Sans (10pt) [Qt], Noto Sans (10pt) [GTK2/3/4]</span>
<span style="color: #61FFCA;">  '/ossssso+/:-        -:/+osssso+-      </span><span style="color: #A277FF;">Cursor:</span><span style="color: #EDECEE;"> volantes (24px)</span>
<span style="color: #61FFCA;"> '+sso+:-'                 '.-/+oso:     </span><span style="color: #A277FF;">Terminal:</span><span style="color: #EDECEE;"> konsole 25.12.2</span>
<span style="color: #61FFCA;">'++:.                           '-/+/    </span><span style="color: #A277FF;">CPU:</span><span style="color: #EDECEE;"> Intel(R) Core(TM) i5-3360M (4) @ 3.50 GHz</span>
<span style="color: #61FFCA;">.'                                 '/    </span><span style="color: #A277FF;">GPU:</span><span style="color: #EDECEE;"> Intel 3rd Gen Core processor Graphics Controller @ 1.20 GHz</span>
                                         <span style="color: #A277FF;">Memory:</span><span style="color: #EDECEE;"> 1.03 GiB / 7.62 GiB (13%)</span>
                                         <span style="color: #A277FF;">Swap:</span><span style="color: #EDECEE;"> 0 B / 4.00 GiB (0%)</span>
                                         <span style="color: #A277FF;">Disk (/):</span><span style="color: #EDECEE;"> 17.15 GiB / 163.00 GiB (11%) - ext4</span>
                                         <span style="color: #A277FF;">Local IP (wlo1):</span><span style="color: #EDECEE;"> 192.168.178.167/24</span>
                                         <span style="color: #A277FF;">Battery (Primary):</span><span style="color: #EDECEE;"> 89% (4 hours, 57 mins remaining) [Discharging]</span>
                                         <span style="color: #A277FF;">Locale:</span><span style="color: #EDECEE;"> de_DE.UTF-8</span>`
    },
    {
      id: 'motte',
      tab: 'motte',
      group: 'mobile',
      title: 'motte.lucya.intra // garbage 1st gen lenovo yogabook',
      width: 950,
      content: `<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">lucya@motte</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#767676;">--------------</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">OS:</span> <span style="color:#F2F2F2;">Windows 11 Pro x86_64</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Host:</span> <span style="color:#F2F2F2;">ZA150085DE (X91F)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Kernel:</span> <span style="color:#F2F2F2;">WIN32_NT 10.0.26100.4202 (24H2)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Uptime:</span> <span style="color:#F2F2F2;">34 mins</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Shell:</span> <span style="color:#F2F2F2;">Windows PowerShell</span>
                                    <span style="color:#F9F1A5;">Display (AUO71D8):</span> <span style="color:#F2F2F2;">1920x1200 @ 60 Hz (as 1280x800) in 10" [Built-in]</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">DE:</span> <span style="color:#F2F2F2;">Fluent</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">WM:</span> <span style="color:#F2F2F2;">Desktop Window Manager 10.0.26100.3624</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">WM Theme:</span> <span style="color:#F2F2F2;">Custom - #0F5E66 (System: Dark, Apps: Dark)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Icons:</span> <span style="color:#F2F2F2;">Recycle Bin</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Font:</span> <span style="color:#F2F2F2;">Segoe UI (12pt) [Caption / Menu / Message / Status]</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Cursor:</span> <span style="color:#F2F2F2;">Windows-Voreinstellung (32px)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Terminal:</span> <span style="color:#F2F2F2;">Windows Terminal 1.18.10301.0</span>
                                    <span style="color:#F9F1A5;">Terminal Font:</span> <span style="color:#F2F2F2;">Cascadia Mono (12pt)</span>
                                    <span style="color:#F9F1A5;">CPU:</span> <span style="color:#F2F2F2;">Intel(R) Atom(TM) x5-Z8550 (4) @ 1,49 GHz</span>
                                    <span style="color:#F9F1A5;">GPU:</span> <span style="color:#F2F2F2;">Intel(R) HD Graphics (114,00 MiB) [Integrated]</span>
                                    <span style="color:#F9F1A5;">Memory:</span> <span style="color:#F2F2F2;">2,72 GiB / 3,92 GiB (69%)</span>
                                    <span style="color:#F9F1A5;">Swap:</span> <span style="color:#F2F2F2;">138,64 MiB / 1,38 GiB (10%)</span>
                                    <span style="color:#F9F1A5;">Disk (C:\\):</span> <span style="color:#F2F2F2;">27,17 GiB / 57,48 GiB (47%) - NTFS</span>
                                    <span style="color:#F9F1A5;">Local IP (WLAN):</span> <span style="color:#F2F2F2;">192.168.178.54/24</span>
                                    <span style="color:#F9F1A5;">Battery (SR Real Battery):</span> <span style="color:#F2F2F2;">77% (3 hours, 56 mins remaining) [Discharging]</span>
                                    <span style="color:#F9F1A5;">Locale:</span> <span style="color:#F2F2F2;">de-DE</span>`
    },
  ];

export const rackData = [
    {
      id: 'lynx', ext: true, u: 2, state: 'on',
      role: 'core hypervisor', chassis: 'Apple Mac mini (Macmini6,2)',
      os: 'Proxmox VE 9.x', cpu: 'Intel Core i7-3615QM (8) @ 3.30 GHz',
      mem: '15.53 GiB', ip: '192.168.178.252/24', neofetch: 'lynx',
      note: 'Sits on top of the cabinet. Runs the always-on core services, which is why it is the one machine that never gets powered down.'
    },
    {
      id: 'vega', ext: true, u: 3, state: 'on',
      role: 'nas', chassis: 'Synology DS918+',
      os: 'DSM 7.3.1-86003 U1', cpu: 'Intel Celeron J3455 (4) @ 1.50 GHz',
      mem: '8.00 GiB', ip: '192.168.178.154/24', neofetch: 'vega',
      note: 'Sits on top of the cabinet next to lynx. Four bays in two RAID 1 pairs — SSD volume plus HDD volume — on a 2 Gbit/s bond. Always on.'
    },
    {
      id: 'chimera', u: 1, state: 'on',
      role: 'hypervisor', chassis: 'Supermicro SYS-5018D-FN4T',
      os: 'Proxmox VE 9.2.4', cpu: 'Intel Xeon D-1541 (16) @ 2.70 GHz',
      mem: '62.69 GiB', ip: '192.168.178.242/24', neofetch: 'chimera',
      note: 'Short-depth 1U board in a low-power SoC chassis — quiet enough to run around the clock.'
    },
    {
      id: 'backup-01', u: 3, state: 'off',
      role: 'cold backup', chassis: 'Lenovo ThinkStation C20x (4269A55)',
      os: 'Windows 7 Professional', cpu: 'Intel Xeon X5690 (12) @ 3.47 GHz',
      mem: '23.99 GiB', ip: '10.174.110.143/24', neofetch: 'backup-01',
      note: 'Powered off by default. Comes up only for backup runs.'
    },
    {
      id: 'unnamed-01', u: 1, state: 'off',
      role: 'unassigned', note: 'Not named, not in service. Data sheet pending.'
    },
    {
      id: 'esxi-02', u: 2, state: 'off',
      role: 'virtualization host', chassis: 'IBM System x3650 M5',
      os: 'VMware ESXi 8.0U3e', cpu: '2 x Intel Xeon E5-2640 v3 (16) @ 2.60 GHz',
      mem: '335.31 GiB', ip: '10.0.3.2/8', neofetch: 'esx-02',
      note: 'Second vSphere host. Off unless the lab needs the capacity — the power draw is not worth it idle.'
    },
    {
      id: 'sw-01', u: 1, state: 'on',
      role: 'switch', chassis: 'Ubiquiti EdgeSwitch 48 Lite', neofetch: 'sw-01', note: 'Rack switch — everything in the cabinet hangs off it, so it stays up with lynx.'
    },
    {
      id: 'esxi-01', u: 2, state: 'standby',
      role: 'virtualization host', chassis: 'Dell PowerEdge R720',
      os: 'VMware ESXi 8.0U3e', cpu: '2 x Intel Xeon E5-2670 (32) @ 3.60 GHz',
      mem: '863.94 GiB', ip: '10.0.3.1/8', neofetch: 'esx-01',
      note: 'Booted on demand for lab work, then shut down again.'
    },
    {
      id: 'unnamed-02', u: 4, state: 'off',
      role: 'unassigned', note: 'Not named, not in service. Data sheet pending.'
    },
    {
      id: 'esxi-03', u: 2, state: 'off',
      role: 'virtualization host', note: 'Powered off. Data sheet pending.'
    }
  ];

